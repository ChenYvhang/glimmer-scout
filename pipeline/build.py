"""Stage6 — merge every stage's output into web/public/dataset.json.

Single static file, fetched once by the frontend. No key ever goes into it
(pipeline/.env stays pipeline-only). Channels without vision/decision
coverage yet get explicit nulls, never fabricated values — the frontend is
expected to render "待分析"/"待接入" for those, per the project's honesty rule.

Run:
    python -m pipeline.build
Reads pipeline/artifacts/{features,scores,quota_log}.json, pipeline/cache/{vision,decisions}/*.json,
pipeline/config/products.yaml. Writes web/public/dataset.json.
"""
import json
from pathlib import Path

import yaml

from pipeline.common.logging import get_logger
from pipeline.score import SUBSCRIBER_TIERS, TOP_K_LIST

logger = get_logger("build")
SUBSCRIBER_TIER_NAMES = [t[0] for t in SUBSCRIBER_TIERS]

ROOT = Path(__file__).resolve().parent
ARTIFACTS_DIR = ROOT / "artifacts"
FEATURES_PATH = ARTIFACTS_DIR / "features.json"
SCORES_PATH = ARTIFACTS_DIR / "scores.json"
QUOTA_LOG_PATH = ARTIFACTS_DIR / "quota_log.json"
VALIDATE_REPORT_PATH = ARTIFACTS_DIR / "validate_report.json"
VISION_CACHE_DIR = ROOT / "cache" / "vision"
DECISIONS_CACHE_DIR = ROOT / "cache" / "decisions"
PRODUCTS_PATH = ROOT / "config" / "products.yaml"
DATASET_OUT_PATH = ROOT.parent / "web" / "public" / "dataset.json"

# Video-level fields kept in the output (drop internal-only ones like raw
# tags/description to keep dataset.json lean — the frontend doesn't need them).
VIDEO_FIELDS = [
    "video_id", "title", "published_at", "view_count", "like_count", "comment_count",
    "duration_seconds", "thumbnail_url", "age_days", "age_bucket",
    "relative_velocity", "season_adjusted_velocity",
]

ARCHITECTURE_LAYERS = [
    {"layer": "数据层", "status": "live",
     "note": "YouTube真实采集+特征工程，年龄偏差已验证消除（中位数漂移斜率0.002 < 0.05阈值）"},
    {"layer": "匹配层", "status": "live_with_caveat",
     "note": "GBDT潜力分+cosine共振分，非黑箱预训练神经网络——demo规模无真实人货匹配监督标签，无法真训练该类模型"},
    {"layer": "裂变层", "status": "live",
     "note": "DeepSeek真实生成本地化脚本变体/字幕要点，非模板"},
    {"layer": "复盘层", "status": "pending",
     "note": "待接入：demo没有真实广告投放/转化数据，无法做真实因果归因，不伪造看板"},
]


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def load_vision_cache() -> dict:
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in VISION_CACHE_DIR.glob("*.json")}


def load_decisions_cache() -> dict:
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in DECISIONS_CACHE_DIR.glob("*.json")}


def load_products() -> list[dict]:
    with open(PRODUCTS_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)["products"]


def build_creator(channel: dict, score_entry: dict | None, vision: dict | None, decision: dict | None) -> dict:
    videos_out = [{k: v.get(k) for k in VIDEO_FIELDS} for v in channel["videos"]]
    thumbnails = [v["thumbnail_url"] for v in sorted(channel["videos"], key=lambda v: v["published_at"], reverse=True) if v.get("thumbnail_url")][:8]

    potential = score_entry.get("potential") if score_entry else None
    resonance = score_entry.get("resonance") if score_entry else None

    return {
        "channel_id": channel["channel_id"],
        "channel_url": f"https://www.youtube.com/channel/{channel['channel_id']}",
        "title": channel.get("title"),
        "country": channel.get("country"),
        "subscriber_count": channel.get("subscriber_count"),
        "view_count_total": channel.get("view_count_total"),
        "video_count_total": channel.get("video_count_total"),
        "channel_age_days": channel.get("channel_age_days"),
        "vertical": channel.get("vertical"),
        "thumbnails": thumbnails,
        "videos": videos_out,
        "features": channel.get("features"),
        "vision": vision,  # None if not yet analyzed — frontend must render "待分析"
        "scores": {
            # potential is {"value","value_lo","value_hi","rank_score"} for
            # dual_head_gbdt, or just {"value"} for the heuristic fallback —
            # "method" is filled in below once known globally.
            "potential": {**potential, "method": None} if potential is not None else None,
            "resonance": resonance,  # dict of product_id -> {value, contributions, feature_breakdown}, or None
        },
        "decision": decision,  # None if not in the pre-generated set — frontend must render "未生成"
    }


def run() -> dict:
    features_data = _load_json(FEATURES_PATH)
    scores_data = _load_json(SCORES_PATH)
    quota_log = _load_json(QUOTA_LOG_PATH) or {}
    validate_report = _load_json(VALIDATE_REPORT_PATH) or {}
    vision_cache = load_vision_cache()
    decisions_cache = load_decisions_cache()
    products = load_products()

    channels = features_data["channels"]
    scores_by_id = scores_data["scores"] if scores_data else {}
    potential_meta = scores_data["potential"] if scores_data else None
    potential_method = potential_meta["method"] if potential_meta else None

    creators = []
    for ch in channels:
        cid = ch["channel_id"]
        creators.append(build_creator(
            ch,
            scores_by_id.get(cid),
            vision_cache.get(cid),
            decisions_cache.get(cid),
        ))
    # Fill in the per-creator potential method now that we know it globally
    for c in creators:
        if c["scores"]["potential"] is not None:
            c["scores"]["potential"]["method"] = potential_method

    total_videos = sum(len(c["videos"]) for c in channels)
    vision_covered = sum(1 for c in creators if c["vision"] is not None)
    decision_covered = sum(1 for c in creators if c["decision"] is not None)

    dataset = {
        "meta": {
            "fetched_at": features_data["fetched_at"],
            "channel_count": len(channels),
            "video_count": total_videos,
            "quota_used": {**quota_log.get("units", {}), "total": sum(quota_log.get("units", {}).values())},
            "model_status": {
                "potential_score_model": potential_method,
                "gbdt_sample_count": potential_meta["training_sample_count"] if potential_meta else None,
            },
            "vision_coverage": {"analyzed": vision_covered, "total": len(creators),
                                 "note": "免费视觉模型限速，未覆盖频道vision/resonance为null，非缺陷"},
            "decision_coverage": {"generated": decision_covered, "total": len(creators)},
            "age_bias_validation": validate_report.get("drift_check"),
            "data_sources": [
                {"platform": "youtube", "status": "connected"},
                {"platform": "tiktok", "status": "pending"},
                {"platform": "douyin", "status": "pending"},
                {"platform": "xiaohongshu", "status": "pending"},
                {"platform": "bilibili", "status": "pending"},
            ],
            "architecture_layers": ARCHITECTURE_LAYERS,
        },
        "season_coefs": features_data["season_coefs"],
        "channel_split": scores_data["channel_split"] if scores_data else None,
        "potential_model": {
            "method": potential_method,
            "training_sample_count": potential_meta["training_sample_count"],
            "positive_label_rate": potential_meta["positive_label_rate"],
            "label_threshold": potential_meta["threshold_stats"],
            "grade_cuts": potential_meta["grade_cuts"],
            "calibration": potential_meta["calibration"],
            "feature_importance": potential_meta["feature_importance"],
        } if potential_meta else None,
        # Stratified Top-K backtest (REFACTOR_PLAN.md §1.4): "global" + one
        # entry per subscriber tier, each with baseline/model hit-rate and
        # lift at K=10/20/50/100. Replaces the old single baseline-vs-model
        # number — a single global lift hid that some tiers (e.g. 1K-10K)
        # can have lift < 1, which is a real, reportable result, not noise
        # to average away.
        "backtest": {
            "primary_k": potential_meta["backtest_stratified"]["primary_k"],
            "k_values": TOP_K_LIST,
            "tiers": [
                {"tier": tier, **potential_meta["backtest_stratified"][tier]}
                for tier in (["global"] + SUBSCRIBER_TIER_NAMES)
            ],
            "excluded_below_1k_count": potential_meta["backtest_stratified"]["excluded_below_1k"]["count"],
        } if potential_meta and potential_meta.get("backtest_stratified") else None,
        "products": products,
        "creators": creators,
    }

    DATASET_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATASET_OUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("wrote %s (%.1f MB)", DATASET_OUT_PATH, DATASET_OUT_PATH.stat().st_size / 1e6)

    summary = {
        "channel_count": len(channels),
        "video_count": total_videos,
        "vision_covered": vision_covered,
        "decision_covered": decision_covered,
        "output_path": str(DATASET_OUT_PATH),
        "output_size_mb": round(DATASET_OUT_PATH.stat().st_size / 1e6, 2),
    }
    logger.info("=== DONE === %s", summary)
    return summary


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2))
