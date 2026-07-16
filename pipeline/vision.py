"""Stage3 — multimodal understanding via GLM-4.6V-Flash (free tier).

Input: real YouTube thumbnails (i.ytimg.com, no video download) + real title/
description/tags metadata, 6-8 videos per channel. Output: an 8-dim
content_vector in the shared semantic space defined in config/dimensions.yaml
(same space products.yaml uses), plus human-readable evidence quoting the
actual thumbnails/titles that justify the score.

API confirmed from https://docs.bigmodel.cn/cn/guide/models/vlm/glm-4.6v on
2026-07-16 (not from memory, per project rule):
  - model name: glm-4.6v-flash (free tier)
  - base_url: https://open.bigmodel.cn/api/paas/v4
  - OpenAI-compatible chat/completions; a single user message's `content` can
    hold multiple {"type": "image_url", "image_url": {"url": ...}} entries
    plus one {"type": "text", ...}
  - Bearer token auth
  - No confirmed JSON-mode parameter, so JSON-ness is enforced via prompt and
    verified by parsing the response; malformed output triggers a retry.

Deviation found by hands-on testing (docs did not mention this): passing a
remote https:// URL in image_url.url reliably fails with HTTP 400 "图片参数
格式/内容错误" after ~30s (the server appears to attempt and fail to fetch
it). Base64 data URIs work. So every thumbnail is downloaded once and sent
as a data:image/jpeg;base64,... URI. The free tier also errors with HTTP 429
"该模型当前并发数过高" under concurrent requests, so calls are serialized
(CONCURRENCY=1) despite the project's "<=3" ceiling being technically looser.

Also observed: some free-tier calls stall for minutes (occasionally longer)
with the connection still technically alive (no single read gap exceeds
requests' own timeout, so requests never raises on its own). Each attempt is
therefore wrapped in a hard wall-clock timeout (see
common.http.call_with_wall_clock_timeout) using the single-shot
post_json_once, with our own retry/backoff loop on top — instead of nesting
this wall clock around the already-retrying post_json, which would let one
stalled attempt multiply into a worst case of minutes x 3 internal retries.

Run:
    python -m pipeline.vision --limit-channels 3   # validation run
    python -m pipeline.vision                       # full run (cached, resumable)
"""
import argparse
import base64
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import yaml
from dotenv import load_dotenv

from pipeline.common.http import call_with_wall_clock_timeout, get_bytes, post_json_once
from pipeline.common.logging import get_logger

logger = get_logger("vision")

ROOT = Path(__file__).resolve().parent
FEATURES_PATH = ROOT / "artifacts" / "features.json"
SCORES_PATH = ROOT / "artifacts" / "scores.json"
DIMENSIONS_PATH = ROOT / "config" / "dimensions.yaml"
CACHE_DIR = ROOT / "cache" / "vision"
FAILURES_PATH = ROOT / "artifacts" / "vision_failures.json"

MODEL_NAME = "glm-4.6v-flash"
BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
MAX_THUMBS_PER_CHANNEL = 8
MIN_THUMBS_PER_CHANNEL = 6
MAX_MODEL_RETRIES = 3
CONCURRENCY = 1  # free-tier hits HTTP 429 "并发数过高" under concurrent calls
REQUEST_SPACING_SECONDS = 1.5  # politeness gap between sequential calls
CALL_WALL_CLOCK_TIMEOUT_SECONDS = 60  # per-attempt hard cap; observed stalls can run for minutes
RETRY_BACKOFF_SECONDS = (2, 4, 8)

REQUIRED_STRING_FIELDS = ["camera_perspective", "narrative_pace", "evidence"]
REQUIRED_NUMERIC_FIELDS = [
    "stabilization_demand", "motion_complexity", "scene_extremity",
    "gear_visibility", "scene_diversity",
]


def load_dimensions() -> list[dict]:
    with open(DIMENSIONS_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    dims = sorted(data["dimensions"], key=lambda d: d["index"])
    return dims


def build_system_prompt(dims: list[dict]) -> str:
    lines = [
        "你是一名体育/户外内容分析专家，负责判断 YouTube 创作者的视频内容特征，"
        "用于运动相机（Insta360）的达人营销匹配。",
        "你会收到该频道最近几条视频的缩略图，以及对应的标题等元数据。",
        "请严格只输出一个 JSON 对象，不要输出任何 JSON 之外的文字、不要用markdown代码块包裹。",
        "",
        "content_vector 是一个长度为8的数组，每个位置对应下面定义的维度（按 index 顺序），"
        "取值范围 0.0-1.0，请参考每个维度的锚点描述打分：",
    ]
    for d in dims:
        lines.append(f"\n[{d['index']}] {d['key']} — {d['name']}：{d['description']}")
        for score, desc in sorted(d["anchors"].items()):
            lines.append(f"    {score}: {desc}")

    lines.append(
        "\n请输出如下结构的 JSON（字段名必须完全一致）：\n"
        "{\n"
        '  "sport_types": ["字符串数组，如 滑雪/越野跑"],\n'
        '  "camera_perspective": "字符串，如 第一人称为主 / 第三人称为主 / 混合",\n'
        '  "stabilization_demand": 0.0到1.0,\n'
        '  "motion_complexity": 0.0到1.0,\n'
        '  "scene_extremity": 0.0到1.0,\n'
        '  "gear_visibility": 0.0到1.0,\n'
        '  "narrative_pace": "字符串，如 快节奏 / 中等节奏 / 慢节奏",\n'
        '  "scene_diversity": 0.0到1.0,\n'
        '  "content_vector": [8个0.0-1.0的浮点数，严格按上面index顺序],\n'
        '  "evidence": "你的判断依据，必须具体引用你看到的缩略图内容与视频标题，不能泛泛而谈"\n'
        "}"
    )
    return "\n".join(lines)


def select_videos_for_vision(channel: dict) -> list[dict]:
    candidates = [v for v in channel["videos"] if v.get("thumbnail_url")]
    candidates.sort(key=lambda v: v["published_at"], reverse=True)
    return candidates[:MAX_THUMBS_PER_CHANNEL]


def _thumbnail_to_data_uri(url: str) -> str:
    img_bytes = get_bytes(url, timeout=(5, 20))
    b64 = base64.b64encode(img_bytes).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def build_user_content(channel: dict, videos: list[dict]) -> list[dict]:
    content = []
    for v in videos:
        content.append({"type": "image_url", "image_url": {"url": _thumbnail_to_data_uri(v["thumbnail_url"])}})
    video_list_text = "\n".join(
        f"- 视频{i+1}: 《{v['title']}》 tags={v.get('tags', [])[:5]}"
        for i, v in enumerate(videos)
    )
    text = (
        f"频道名称：{channel['title']}\n"
        f"频道简介：{(channel.get('description') or '')[:300]}\n"
        f"种子垂类标签（仅供参考，不必完全采信）：{channel.get('vertical')}\n"
        f"以上图片依次对应以下视频（图1对应视频1，以此类推）：\n{video_list_text}\n\n"
        "请结合图片与文字信息，输出前面系统提示要求的 JSON。"
    )
    content.append({"type": "text", "text": text})
    return content


def _extract_json(raw_text: str) -> dict:
    text = raw_text.strip()
    text = re.sub(r"^```(json)?", "", text.strip()).strip()
    text = re.sub(r"```$", "", text.strip()).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object found in model output: {text[:200]!r}")
    return json.loads(text[start : end + 1])


def _validate_vision_json(data: dict) -> None:
    for field in REQUIRED_STRING_FIELDS:
        if not isinstance(data.get(field), str) or not data[field].strip():
            raise ValueError(f"missing/invalid string field: {field}")
    for field in REQUIRED_NUMERIC_FIELDS:
        val = data.get(field)
        if not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 1.0):
            raise ValueError(f"missing/invalid numeric field: {field}={val!r}")
    vec = data.get("content_vector")
    if not isinstance(vec, list) or len(vec) != 8 or not all(
        isinstance(x, (int, float)) and 0.0 <= float(x) <= 1.0 for x in vec
    ):
        raise ValueError(f"invalid content_vector: {vec!r}")
    if not isinstance(data.get("sport_types"), list):
        raise ValueError(f"invalid sport_types: {data.get('sport_types')!r}")


class VisionAdapter:
    def __init__(self, api_key: str, dims: list[dict]):
        self.api_key = api_key
        self.system_prompt = build_system_prompt(dims)

    def analyze_channel(self, channel: dict) -> dict:
        videos = select_videos_for_vision(channel)
        if len(videos) < MIN_THUMBS_PER_CHANNEL:
            raise ValueError(
                f"only {len(videos)} thumbnails available, need >= {MIN_THUMBS_PER_CHANNEL}"
            )
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": build_user_content(channel, videos)},
            ],
        }
        time.sleep(REQUEST_SPACING_SECONDS)
        last_exc = None
        for attempt in range(1, MAX_MODEL_RETRIES + 1):
            try:
                resp = call_with_wall_clock_timeout(
                    post_json_once,
                    CALL_WALL_CLOCK_TIMEOUT_SECONDS,
                    f"{BASE_URL}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=(10, CALL_WALL_CLOCK_TIMEOUT_SECONDS - 5),
                )
                content = resp["choices"][0]["message"]["content"]
                data = _extract_json(content)
                _validate_vision_json(data)
                data["model"] = MODEL_NAME
                data["source_video_ids"] = [v["video_id"] for v in videos]
                data["analyzed_at"] = datetime.now(timezone.utc).isoformat()
                return data
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "vision call failed for channel=%s (attempt %d/%d): %s",
                    channel["channel_id"], attempt, MAX_MODEL_RETRIES, exc,
                )
                if attempt < MAX_MODEL_RETRIES:
                    time.sleep(RETRY_BACKOFF_SECONDS[attempt - 1])
        raise last_exc


def run(limit_channels: int | None, top_n_by_potential: int | None):
    load_dotenv(ROOT.parent / ".env")
    api_key = os.environ.get("ZHIPU_API_KEY")
    if not api_key:
        raise SystemExit("ZHIPU_API_KEY not set in .env")

    dims = load_dimensions()
    adapter = VisionAdapter(api_key, dims)

    data = json.loads(FEATURES_PATH.read_text(encoding="utf-8"))
    channels = data["channels"]

    pending = []
    cached_count = 0
    for ch in channels:
        cache_path = CACHE_DIR / f"{ch['channel_id']}.json"
        if cache_path.exists():
            cached_count += 1
            continue
        pending.append(ch)

    if top_n_by_potential:
        # Free-tier throughput can't cover all channels in a reasonable time
        # (observed ~3-4 min/channel incl. 429 retries). P (potential_score)
        # doesn't need vision at all, so we already have a real score to
        # prioritize by — spend the slow vision budget on the channels most
        # likely to matter for the final P x R ranking, not collection order.
        scores = json.loads(SCORES_PATH.read_text(encoding="utf-8"))["scores"]
        pending.sort(key=lambda ch: -(scores.get(ch["channel_id"], {}).get("potential") or -1))
        pending = pending[:top_n_by_potential]
        logger.info("scoped to top %d channels by potential_score (P computed without vision data)",
                    top_n_by_potential)
    elif limit_channels:
        pending = pending[:limit_channels]

    logger.info(
        "%d channels total, %d already cached, %d to process this run",
        len(channels), cached_count, len(pending),
    )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    succeeded = 0

    def process(ch):
        return ch, adapter.analyze_channel(ch)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(process, ch): ch for ch in pending}
        for fut in as_completed(futures):
            ch = futures[fut]
            try:
                _, result = fut.result()
                cache_path = CACHE_DIR / f"{ch['channel_id']}.json"
                cache_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
                succeeded += 1
                logger.info("[%d/%d] OK channel=%s (%s): sport_types=%s",
                            succeeded, len(pending), ch["channel_id"], ch["title"], result["sport_types"])
            except Exception as exc:
                failures.append({"channel_id": ch["channel_id"], "title": ch["title"], "error": str(exc)})
                logger.error("FAILED channel=%s (%s) after retries: %s", ch["channel_id"], ch["title"], exc)

    if failures:
        FAILURES_PATH.parent.mkdir(parents=True, exist_ok=True)
        existing = []
        if FAILURES_PATH.exists():
            existing = json.loads(FAILURES_PATH.read_text(encoding="utf-8"))
        FAILURES_PATH.write_text(json.dumps(existing + failures, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "processed_this_run": len(pending),
        "succeeded": succeeded,
        "failed": len(failures),
        "already_cached": cached_count,
    }
    logger.info("=== DONE === %s", summary)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-channels", type=int, default=None, help="process first N pending channels (validation)")
    parser.add_argument("--top-n-by-potential", type=int, default=None,
                         help="scope to top N pending channels by potential_score (requires scores.json from score.py)")
    args = parser.parse_args()
    print(json.dumps(run(args.limit_channels, args.top_n_by_potential), ensure_ascii=False, indent=2))
