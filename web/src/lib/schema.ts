// TS types mirroring web/public/dataset.json, generated from the real Stage6
// build.py output (not the illustrative sketch in PLAN.md §3) — field shapes
// were verified against a live dataset.json before writing this file.

export interface QuotaUsed {
  search: number;
  channels: number;
  playlistItems: number;
  videos: number;
  total: number;
}

export interface ModelStatus {
  potential_score_model: "gbdt" | "heuristic";
  gbdt_sample_count: number;
}

export interface CoverageStat {
  analyzed?: number;
  generated?: number;
  total: number;
  note?: string;
}

export interface AgeBiasValidation {
  slope: number;
  spread_for_reference: number;
  threshold: number;
  pass: boolean;
}

export interface DataSource {
  platform: string;
  status: "connected" | "pending";
}

export type ArchitectureLayerStatus = "live" | "live_with_caveat" | "pending";

export interface ArchitectureLayer {
  layer: string;
  status: ArchitectureLayerStatus;
  note: string;
}

export interface DatasetMeta {
  fetched_at: string;
  channel_count: number;
  video_count: number;
  quota_used: QuotaUsed;
  model_status: ModelStatus;
  vision_coverage: CoverageStat;
  decision_coverage: CoverageStat;
  age_bias_validation: AgeBiasValidation;
  data_sources: DataSource[];
  architecture_layers: ArchitectureLayer[];
}

export interface SeasonCoef {
  coefs: number[];
  insufficient_sample: boolean;
  sample_size: number;
}

export interface FeatureImportanceEntry {
  feature: string;
  contribution: number;
}

export interface PotentialModel {
  method: "gbdt" | "heuristic";
  training_sample_count: number;
  positive_label_rate: number;
  holdout_metrics: {
    accuracy: number;
    auc: number;
    test_size: number;
    train_size: number;
  };
  feature_importance: FeatureImportanceEntry[];
}

export interface Backtest {
  method: string;
  eligible_channel_count: number;
  top_k: number;
  baseline: { name: string; hit_rate: number };
  nextscout: { name: string; hit_rate: number };
  lift: number;
}

export interface FeatureWeight {
  dims: string[];
  weight: number;
  note?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  vector: number[];
  feature_weights: Record<string, FeatureWeight>;
}

export interface CreatorVideo {
  video_id: string;
  title: string;
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration_seconds: number;
  thumbnail_url: string;
  age_days: number;
  age_bucket: "0-7" | "7-30" | "30-90" | "90-365" | "365+";
  relative_velocity: number | null;
  season_adjusted_velocity: number | null;
}

export interface CreatorFeatures {
  publish_cadence_30d: number;
  publish_cadence_90d: number;
  publish_interval_mean_days: number | null;
  publish_interval_std_days: number | null;
  recent_relative_velocity_mean: number | null;
  engagement_like_ratio: number;
  engagement_comment_ratio: number;
  engagement_trend: number | null;
  momentum_acceleration: number | null;
  inflection_point: string | null;
  raw_momentum: number | null;
  subscriber_view_ratio: number | null;
  video_count_with_velocity: number;
  adjusted_momentum: number | null;
}

export interface CreatorVision {
  sport_types: string[];
  camera_perspective: string;
  stabilization_demand: number;
  motion_complexity: number;
  scene_extremity: number;
  gear_visibility: number;
  narrative_pace: string;
  scene_diversity: number;
  content_vector: number[];
  evidence: string;
  model: string;
  source_video_ids: string[];
  analyzed_at: string;
}

export interface PotentialScore {
  value: number;
  method: "gbdt" | "heuristic";
}

export interface ResonanceContribution {
  dim: string;
  contribution: number;
}

export interface ResonanceScore {
  value: number;
  contributions: ResonanceContribution[];
  feature_breakdown: Record<string, number>;
}

export interface CreatorScores {
  potential: PotentialScore;
  resonance: Record<string, ResonanceScore>; // keyed by product id
}

export interface CreativeVariant {
  variant_name: string;
  script_direction: string;
  subtitle_highlights: string[];
  target_platform_note: string;
  target_market: string;
}

export interface RiskReview {
  competitor_flag: boolean;
  flagged_keywords: string[];
  conclusion: string;
}

export interface PriceRange {
  min: number | null;
  max: number | null;
  currency: string;
  basis: string;
}

export interface CreatorDecision {
  recommended_product: string;
  potential_score: number;
  resonance_score: number;
  combined_score: number;
  reasoning: string;
  creative_variants: CreativeVariant[];
  price_range: PriceRange;
  risk_review: RiskReview;
  localization_notes: string;
}

export interface Creator {
  channel_id: string;
  channel_url: string;
  title: string;
  country: string | null;
  subscriber_count: number;
  view_count_total: number;
  video_count_total: number;
  channel_age_days: number;
  vertical: string;
  thumbnails: string[];
  videos: CreatorVideo[];
  features: CreatorFeatures;
  vision: CreatorVision | null;
  scores: CreatorScores;
  decision: CreatorDecision | null;
}

export interface Dataset {
  meta: DatasetMeta;
  season_coefs: Record<string, SeasonCoef>;
  potential_model: PotentialModel;
  backtest: Backtest;
  products: Product[];
  creators: Creator[];
}
