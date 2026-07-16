"""Stage4 — 匹配层：潜力分 P (self-supervised GBDT) + 共振分 R (cosine similarity) + 回测.

P (potential_score): self-supervised — for each channel, split its own video
history at T = fetched_at - 60d. Features come only from videos published
before T; the label is "did relative_velocity (peer-normalized, so no age
leakage) after T end up meaningfully higher than before T". Train
HistGradientBoostingClassifier on this; if fewer than 100 channels qualify,
fall back to a transparent heuristic and say so in the output — never fake a
"trained" model.

R (resonance_score): pure cosine similarity between vision.py's content_vector
and each product's hand-defined vector in the same 8-dim space (config/products.yaml).
No LLM involved. Only computed for channels that already have a vision cache
entry — others get resonance=None, honestly reflecting "not analyzed yet".

Run:
    python -m pipeline.score
Reads pipeline/artifacts/features.json + pipeline/cache/vision/*.json,
writes pipeline/artifacts/scores.json.
"""
import json
import math
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import yaml
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

from pipeline.common.logging import get_logger

logger = get_logger("score")

ROOT = Path(__file__).resolve().parent
FEATURES_PATH = ROOT / "artifacts" / "features.json"
VISION_CACHE_DIR = ROOT / "cache" / "vision"
DIMENSIONS_PATH = ROOT / "config" / "dimensions.yaml"
PRODUCTS_PATH = ROOT / "config" / "products.yaml"
SCORES_OUT_PATH = ROOT / "artifacts" / "scores.json"

T_DAYS_BEFORE_FETCH = 60
MIN_WINDOW_VIDEOS = 3
ACCELERATION_THRESHOLD = 1.2  # post-T median must exceed pre-T median by >=20% to count as "accelerating"
MIN_GBDT_SAMPLES = 100
TOP_K_BACKTEST = 20

FEATURE_NAMES = [
    "video_count_in_window",
    "publish_interval_mean_days",
    "publish_interval_std_days",
    "engagement_like_ratio_mean",
    "engagement_comment_ratio_mean",
    "relative_velocity_mean",
    "relative_velocity_std",
    "channel_age_days_at_window_end",
]
# subscriber_count / view_count_total are deliberately excluded: they're
# current-snapshot totals (single-crawl design has no as-of-T values), so
# using them as "pre-T" features leaks post-T growth — exactly the outcome
# the label is trying to predict — straight into the inputs.


def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def extract_window_features(channel: dict, videos_subset: list[dict], window_end: datetime) -> list[float]:
    n = len(videos_subset)
    if n == 0:
        return [math.nan] * len(FEATURE_NAMES)

    sorted_v = sorted(videos_subset, key=lambda v: v["published_at"])
    published_dt = [_parse_iso(v["published_at"]) for v in sorted_v]
    intervals = [(b - a).total_seconds() / 86400 for a, b in zip(published_dt, published_dt[1:])]
    interval_mean = sum(intervals) / len(intervals) if intervals else math.nan
    interval_std = statistics.stdev(intervals) if len(intervals) >= 2 else math.nan

    like_ratios = [
        v["like_count"] / v["view_count"]
        for v in videos_subset
        if v.get("like_count") is not None and v["view_count"] > 0
    ]
    comment_ratios = [
        v["comment_count"] / v["view_count"]
        for v in videos_subset
        if v.get("comment_count") is not None and v["view_count"] > 0
    ]
    like_mean = sum(like_ratios) / len(like_ratios) if like_ratios else math.nan
    comment_mean = sum(comment_ratios) / len(comment_ratios) if comment_ratios else math.nan

    rv = [v["relative_velocity"] for v in videos_subset if v.get("relative_velocity") is not None]
    rv_mean = sum(rv) / len(rv) if rv else math.nan
    rv_std = statistics.stdev(rv) if len(rv) >= 2 else math.nan

    channel_created = _parse_iso(channel["published_at"]) if channel.get("published_at") else None
    age_at_window_end = (window_end - channel_created).days if channel_created else math.nan

    return [
        n, interval_mean, interval_std, like_mean, comment_mean,
        rv_mean, rv_std, age_at_window_end,
    ]


def build_training_set(channels: list[dict], fetched_at: datetime):
    t_cutoff = fetched_at - timedelta(days=T_DAYS_BEFORE_FETCH)
    rows, labels, channel_ids = [], [], []
    for ch in channels:
        videos = ch["videos"]
        pre = [v for v in videos if _parse_iso(v["published_at"]) < t_cutoff]
        post = [v for v in videos if _parse_iso(v["published_at"]) >= t_cutoff]
        pre_rv = [v["relative_velocity"] for v in pre if v.get("relative_velocity") is not None]
        post_rv = [v["relative_velocity"] for v in post if v.get("relative_velocity") is not None]
        if len(pre_rv) < MIN_WINDOW_VIDEOS or len(post_rv) < MIN_WINDOW_VIDEOS:
            continue
        pre_median = statistics.median(pre_rv)
        post_median = statistics.median(post_rv)
        label = 1 if (pre_median > 0 and post_median > pre_median * ACCELERATION_THRESHOLD) else 0
        rows.append(extract_window_features(ch, pre, t_cutoff))
        labels.append(label)
        channel_ids.append(ch["channel_id"])
    return rows, labels, channel_ids, t_cutoff


def heuristic_potential_score(features: dict) -> float:
    """Transparent weighted heuristic, used only when <100 training samples.

    Each raw signal is squashed into [0,1] via a monotonic function (sigmoid
    for unbounded signals, clip for ones with a natural ceiling), then
    combined with fixed weights. Missing signals default to 0.5 (neutral)
    rather than 0, so sparse data isn't automatically penalized.
    """
    def sigmoid(x):
        return 1 / (1 + math.exp(-x))

    accel = features.get("momentum_acceleration")
    accel_c = sigmoid(accel) if accel is not None else 0.5

    rv = features.get("recent_relative_velocity_mean")
    velocity_c = sigmoid(math.log(rv)) if rv is not None and rv > 0 else 0.5

    trend = features.get("engagement_trend")
    trend_c = sigmoid(trend * 1000) if trend is not None else 0.5

    cadence = features.get("publish_cadence_30d")
    cadence_c = min(cadence / 10, 1.0) if cadence is not None else 0.5

    score = 100 * (0.4 * accel_c + 0.3 * velocity_c + 0.15 * trend_c + 0.15 * cadence_c)
    return score


def compute_potential_scores(channels: list[dict], fetched_at: datetime) -> dict:
    rows, labels, channel_ids, t_cutoff = build_training_set(channels, fetched_at)
    n_samples = len(rows)
    logger.info(
        "self-supervised training set: %d channels qualify (need pre/post >= %d videos each), "
        "T cutoff = %s (fetched_at - %dd)",
        n_samples, MIN_WINDOW_VIDEOS, t_cutoff.isoformat(), T_DAYS_BEFORE_FETCH,
    )
    label_rate = sum(labels) / n_samples if n_samples else None
    logger.info("positive (accelerating) label rate: %s", label_rate)

    result = {
        "method": None,
        "training_sample_count": n_samples,
        "positive_label_rate": label_rate,
        "holdout_metrics": None,
        "feature_importance": None,
        "scores": {},  # channel_id -> potential_score (0-100)
        "backtest": None,
    }

    if n_samples >= MIN_GBDT_SAMPLES:
        result["method"] = "gbdt"
        X = np.array(rows, dtype=float)
        y = np.array(labels, dtype=int)
        X_train, X_test, y_train, y_test, ids_train, ids_test = train_test_split(
            X, y, channel_ids, test_size=0.2, random_state=42, stratify=y if len(set(y)) > 1 else None,
        )
        model = HistGradientBoostingClassifier(random_state=42)
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        acc = accuracy_score(y_test, y_pred)
        try:
            auc = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else None
        except ValueError:
            auc = None
        result["holdout_metrics"] = {
            "accuracy": acc, "auc": auc,
            "test_size": len(y_test), "train_size": len(y_train),
        }
        logger.info("GBDT holdout: accuracy=%.3f auc=%s (train=%d test=%d)",
                     acc, auc, len(y_train), len(y_test))

        perm = permutation_importance(model, X_test, y_test, n_repeats=10, random_state=42)
        importance = sorted(
            [{"feature": name, "contribution": float(imp)} for name, imp in zip(FEATURE_NAMES, perm.importances_mean)],
            key=lambda d: -d["contribution"],
        )
        result["feature_importance"] = importance

        # Refit on ALL qualifying data for the final production model, then
        # score every channel using its FULL current history as the window
        # (not just pre-T) — we want "how likely to accelerate from now on".
        model_final = HistGradientBoostingClassifier(random_state=42)
        model_final.fit(X, y)
        for ch in channels:
            feats = extract_window_features(ch, ch["videos"], fetched_at)
            proba = model_final.predict_proba(np.array([feats]))[0, 1]
            result["scores"][ch["channel_id"]] = float(proba) * 100
    else:
        result["method"] = "heuristic"
        logger.warning(
            "only %d qualifying samples (<%d) — falling back to heuristic potential score, "
            "NOT a trained model", n_samples, MIN_GBDT_SAMPLES,
        )
        for ch in channels:
            result["scores"][ch["channel_id"]] = heuristic_potential_score(ch["features"])

    # Backtest: baseline (rank by subscriber_count) vs NextScout (rank by potential_score),
    # both evaluated against the same self-supervised "did it actually accelerate" label,
    # restricted to channels that have that label (the qualifying training set).
    if n_samples > 0:
        subscriber_by_id = {c["channel_id"]: (c.get("subscriber_count") or 0) for c in channels}
        eligible = [
            {
                "channel_id": cid,
                "label": label,
                "subscriber_count": subscriber_by_id[cid],
                "potential_score": result["scores"][cid],
            }
            for cid, label in zip(channel_ids, labels)
        ]
        k = min(TOP_K_BACKTEST, len(eligible))
        baseline_top = sorted(eligible, key=lambda d: -d["subscriber_count"])[:k]
        nextscout_top = sorted(eligible, key=lambda d: -d["potential_score"])[:k]
        baseline_hit_rate = sum(d["label"] for d in baseline_top) / k
        nextscout_hit_rate = sum(d["label"] for d in nextscout_top) / k
        lift = (nextscout_hit_rate / baseline_hit_rate) if baseline_hit_rate > 0 else None
        result["backtest"] = {
            "method": f"自监督标签：T=fetched_at-{T_DAYS_BEFORE_FETCH}天，"
                      f"T后relative_velocity中位数 > T前中位数 x {ACCELERATION_THRESHOLD} 判定为'加速'",
            "eligible_channel_count": len(eligible),
            "top_k": k,
            "baseline": {"name": "按订阅数排序", "hit_rate": baseline_hit_rate},
            "nextscout": {"name": "按潜力分P排序", "hit_rate": nextscout_hit_rate},
            "lift": lift,
        }
        logger.info("backtest (top-%d, n=%d eligible): baseline=%.3f nextscout=%.3f lift=%s",
                     k, len(eligible), baseline_hit_rate, nextscout_hit_rate, lift)

    return result


def load_dimensions_index() -> dict:
    with open(DIMENSIONS_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return {d["key"]: d["index"] for d in data["dimensions"]}


def load_products() -> list[dict]:
    with open(PRODUCTS_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data["products"]


def load_vision_cache() -> dict:
    cache = {}
    for path in VISION_CACHE_DIR.glob("*.json"):
        cache[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return cache


def cosine_similarity_with_contributions(content_vec: list[float], product_vec: list[float]) -> tuple[float, list[float]]:
    c = np.array(content_vec, dtype=float)
    p = np.array(product_vec, dtype=float)
    norm_c, norm_p = np.linalg.norm(c), np.linalg.norm(p)
    if norm_c == 0 or norm_p == 0:
        return 0.0, [0.0] * len(content_vec)
    denom = norm_c * norm_p
    per_dim_contribution = (c * p) / denom  # sums exactly to cosine similarity
    cosine = float(per_dim_contribution.sum())
    return cosine, per_dim_contribution.tolist()


def compute_resonance_scores(channels: list[dict], vision_cache: dict, products: list[dict], dim_index: dict) -> dict:
    resonance = {}
    analyzed = 0
    for ch in channels:
        vision = vision_cache.get(ch["channel_id"])
        if vision is None:
            resonance[ch["channel_id"]] = None
            continue
        analyzed += 1
        content_vec = vision["content_vector"]
        by_product = {}
        for prod in products:
            cosine, contributions = cosine_similarity_with_contributions(content_vec, prod["vector"])
            feature_breakdown = {}
            for feat_name, weight_info in prod["feature_weights"].items():
                dims = weight_info["dims"]
                idxs = [dim_index[d] for d in dims]
                prod_weight_sum = sum(prod["vector"][i] for i in idxs)
                if prod_weight_sum > 0:
                    feature_score = 100 * sum(content_vec[i] * prod["vector"][i] for i in idxs) / prod_weight_sum
                else:
                    feature_score = 0.0
                feature_breakdown[feat_name] = feature_score
            by_product[prod["id"]] = {
                "value": cosine * 100,
                "contributions": [
                    {"dim": dim_key, "contribution": contributions[idx] * 100}
                    for dim_key, idx in dim_index.items()
                ],
                "feature_breakdown": feature_breakdown,
            }
        resonance[ch["channel_id"]] = by_product
    logger.info("resonance computed for %d/%d channels (rest awaiting vision analysis)", analyzed, len(channels))
    return resonance


def run() -> dict:
    data = json.loads(FEATURES_PATH.read_text(encoding="utf-8"))
    channels = data["channels"]
    fetched_at = _parse_iso(data["fetched_at"])

    potential = compute_potential_scores(channels, fetched_at)

    dim_index = load_dimensions_index()
    products = load_products()
    vision_cache = load_vision_cache()
    resonance = compute_resonance_scores(channels, vision_cache, products, dim_index)

    out = {
        "fetched_at": data["fetched_at"],
        "potential": {
            "method": potential["method"],
            "training_sample_count": potential["training_sample_count"],
            "positive_label_rate": potential["positive_label_rate"],
            "holdout_metrics": potential["holdout_metrics"],
            "feature_importance": potential["feature_importance"],
        },
        "backtest": potential["backtest"],
        "scores": {
            cid: {
                "potential": potential["scores"].get(cid),
                "resonance": resonance.get(cid),
            }
            for cid in [c["channel_id"] for c in channels]
        },
    }
    SCORES_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SCORES_OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("wrote %s", SCORES_OUT_PATH)
    return {
        "method": potential["method"],
        "training_sample_count": potential["training_sample_count"],
        "backtest": potential["backtest"],
        "resonance_analyzed_count": sum(1 for v in resonance.values() if v is not None),
    }


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2))
