import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
} from "recharts";
import clsx from "clsx";
import type { Creator, Product } from "../lib/schema";

interface Props {
  creator: Creator;
  products: Product[];
  onClose: () => void;
}

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 pt-4 mt-4 first:mt-0 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-gray-200 mb-2">{title}</h3>
      {children}
    </section>
  );
}

export default function CreatorDrawer({ creator, products, onClose }: Props) {
  const velocitySeries = useMemo(
    () =>
      creator.videos
        .filter((v) => v.relative_velocity !== null)
        .slice()
        .sort((a, b) => a.published_at.localeCompare(b.published_at))
        .map((v) => ({
          date: v.published_at.slice(0, 10),
          relative_velocity: v.relative_velocity,
          season_adjusted_velocity: v.season_adjusted_velocity,
        })),
    [creator],
  );

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-[720px] h-full bg-[#12141b] border-l border-white/10 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#12141b]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{creator.title}</h2>
            <a
              href={creator.channel_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-glimmer-400 hover:underline"
            >
              {creator.channel_url}
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-white text-xl leading-none px-2"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Layer 1: 基础信息 */}
          <Section title="① 基础信息">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="垂类" value={creator.vertical} />
              <Stat label="国家/地区" value={creator.country ?? "未知"} />
              <Stat label="订阅数" value={fmtNum(creator.subscriber_count)} />
              <Stat label="总播放量" value={fmtNum(creator.view_count_total)} />
              <Stat label="视频总数" value={fmtNum(creator.video_count_total)} />
              <Stat label="频道年龄（天）" value={fmtNum(creator.channel_age_days)} />
            </div>
            {creator.thumbnails.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {creator.thumbnails.slice(0, 8).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-16 w-28 object-cover rounded-md border border-white/10 shrink-0"
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Layer 2: 动能特征 */}
          <Section title="② 动能特征（数据层）">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
              <Stat label="加速度 momentum_acceleration" value={fmtNum(creator.features.momentum_acceleration, 3)} />
              <Stat label="季节调整动能 adjusted_momentum" value={fmtNum(creator.features.adjusted_momentum, 3)} />
              <Stat label="拐点日期" value={creator.features.inflection_point?.slice(0, 10) ?? "无"} />
              <Stat label="近90天发布数" value={fmtNum(creator.features.publish_cadence_90d)} />
              <Stat label="点赞率" value={fmtNum(creator.features.engagement_like_ratio * 100, 2) + "%"} />
              <Stat label="评论率" value={fmtNum(creator.features.engagement_comment_ratio * 100, 3) + "%"} />
            </div>
            {velocitySeries.length > 1 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={velocitySeries} margin={{ left: -20, top: 4, right: 8 }}>
                    <CartesianGrid stroke="#2a2d38" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8b8f9c" }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10, fill: "#8b8f9c" }} width={36} />
                    <Tooltip
                      contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }}
                      labelStyle={{ color: "#e5e7eb" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="relative_velocity"
                      stroke="#c98500"
                      dot={false}
                      strokeWidth={2}
                      name="相对动能"
                    />
                    <Line
                      type="monotone"
                      dataKey="season_adjusted_velocity"
                      stroke="#0284c7"
                      dot={false}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      name="季节调整动能"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* Layer 3: 视觉理解 */}
          <Section title="③ 视觉理解（匹配层 · GLM-4.6V-Flash）">
            {creator.vision ? (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Stat label="运动类型" value={creator.vision.sport_types.join("、") || "—"} />
                  <Stat label="镜头视角" value={creator.vision.camera_perspective} />
                  <Stat label="叙事节奏" value={creator.vision.narrative_pace} />
                  <Stat label="防抖需求" value={fmtNum(creator.vision.stabilization_demand, 2)} />
                  <Stat label="场景极限度" value={fmtNum(creator.vision.scene_extremity, 2)} />
                  <Stat label="装备可见度" value={fmtNum(creator.vision.gear_visibility, 2)} />
                </div>
                <p className="text-gray-400 text-xs leading-relaxed bg-white/5 rounded-md p-3 mt-2">
                  {creator.vision.evidence}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">未分析——该频道尚未进入视觉理解队列，属实覆盖率限制，非数据缺陷。</p>
            )}
          </Section>

          {/* Layer 4: 匹配分 */}
          <Section title="④ 匹配分（潜力分 P × 共振分 R）">
            <div className="flex items-center gap-6 mb-3">
              <div>
                <div className="text-xs text-gray-500">潜力分 P</div>
                <div className="text-2xl font-semibold text-glimmer-300">{fmtNum(creator.scores.potential.value, 1)}</div>
              </div>
            </div>
            {creator.scores.resonance ? (
              <div className="space-y-4">
                {Object.entries(creator.scores.resonance).map(([productId, r]) => {
                  const product = productById.get(productId);
                  const data = Object.entries(r.feature_breakdown).map(([name, value]) => ({ name, value }));
                  return (
                    <div key={productId} className="border border-white/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-200">{product?.name ?? productId}</span>
                        <span className="text-sm text-sky-300 font-semibold">R = {fmtNum(r.value, 1)}</span>
                      </div>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#8b8f9c" }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={90}
                              tick={{ fontSize: 10, fill: "#8b8f9c" }}
                            />
                            <Tooltip
                              contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }}
                            />
                            <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">共振分待计算——依赖视觉理解结果，该频道尚未覆盖。</p>
            )}
          </Section>

          {/* Layer 5: 决策卡 */}
          <Section title="⑤ 决策卡（裂变层 · DeepSeek）">
            {creator.decision ? (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="px-2 py-1 rounded-md bg-glimmer-500/15 text-glimmer-300 text-xs">
                    推荐单品：{productById.get(creator.decision.recommended_product)?.name ?? creator.decision.recommended_product}
                  </span>
                  <span className="text-xs text-gray-500">
                    综合分 combined = {fmtNum(creator.decision.combined_score, 2)}
                  </span>
                  {creator.decision.risk_review.competitor_flag && (
                    <span className="px-2 py-1 rounded-md bg-red-500/15 text-red-300 text-xs">
                      竞品风险：{creator.decision.risk_review.flagged_keywords.join(", ")}
                    </span>
                  )}
                </div>
                <p className="text-gray-300 leading-relaxed">{creator.decision.reasoning}</p>
                <div className="text-xs text-gray-500">
                  建议报价区间：
                  {creator.decision.price_range.min !== null
                    ? ` $${creator.decision.price_range.min} - $${creator.decision.price_range.max}`
                    : " 无法估算（订阅数隐藏）"}
                  {creator.decision.price_range.basis && ` · ${creator.decision.price_range.basis}`}
                </div>
                <div className="text-xs text-gray-500">{creator.decision.localization_notes}</div>
                {creator.decision.risk_review.competitor_flag && (
                  <p className="text-xs text-red-300/80">{creator.decision.risk_review.conclusion}</p>
                )}

                <div className="space-y-2 mt-2">
                  {creator.decision.creative_variants.map((variant) => (
                    <div key={variant.variant_name} className="border border-white/10 rounded-lg p-3">
                      <div className="font-medium text-gray-200 text-sm mb-1">{variant.variant_name}</div>
                      <p className="text-gray-400 text-xs leading-relaxed mb-2">{variant.script_direction}</p>
                      <ul className="list-disc list-inside text-xs text-gray-400 space-y-0.5 mb-2">
                        {variant.subtitle_highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                      <div className="flex gap-3 text-[11px] text-gray-500">
                        <span>{variant.target_platform_note}</span>
                        <span>· 目标市场：{variant.target_market}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                未生成——决策卡仅对潜力/共振综合分Top-60预生成，该频道不在当前批次内。
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={clsx("flex flex-col")}>
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
