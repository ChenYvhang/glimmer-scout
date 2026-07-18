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
import { useState } from "react";
import clsx from "clsx";
import type { Creator, Product } from "../lib/schema";
import { addToCandidatePool, removeFromCandidatePool } from "../lib/candidatePool";
import { useCandidatePool } from "../lib/useCandidatePool";
import { getOutcome, saveOutcome } from "../lib/outcomeStore";

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
      <h3 className="text-sm font-semibold text-ink-100 mb-2">{title}</h3>
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
  const { ids: poolIds } = useCandidatePool();
  const inPool = poolIds.includes(creator.channel_id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-[720px] h-full bg-[#12141b] border-l border-white/10 overflow-y-auto shadow-2xl animate-slide-in-right">
        <div className="sticky top-0 bg-[#12141b]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-100 truncate">{creator.title}</h2>
            <a
              href={creator.channel_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              {creator.channel_url}
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                inPool ? removeFromCandidatePool(creator.channel_id) : addToCandidatePool([creator.channel_id])
              }
              className={clsx(
                "text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                inPool
                  ? "border-white/20 text-ink-100 hover:bg-white/5"
                  : "border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10",
              )}
            >
              {inPool ? "移出候选池" : "+ 加入候选池"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-400 hover:text-ink-100 text-xl leading-none px-2 transition-all duration-200 hover:rotate-90"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
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
                      stroke="#ff8b26"
                      dot={false}
                      strokeWidth={2}
                      name="相对动能"
                    />
                    <Line
                      type="monotone"
                      dataKey="season_adjusted_velocity"
                      stroke="#6b7280"
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
                <p className="text-ink-400 text-xs leading-relaxed bg-white/5 rounded-md p-3 mt-2">
                  {creator.vision.evidence}
                </p>
              </div>
            ) : (
              <p className="text-ink-400 text-sm">未分析——尚未进入视觉理解队列。</p>
            )}
          </Section>

          {/* Layer 4: 匹配分 */}
          <Section title="④ 匹配分（潜力分 P × 共振分 R）">
            <div className="mb-4">
              <div className="text-xs text-ink-400 mb-1">
                潜力分 P
                {creator.scores.potential.value_lo !== undefined && creator.scores.potential.value_hi !== undefined && (
                  <span> · conformal 区间 [{fmtNum(creator.scores.potential.value_lo, 1)}, {fmtNum(creator.scores.potential.value_hi, 1)}]</span>
                )}
              </div>
              <div className="text-2xl font-semibold text-accent mb-1.5">{fmtNum(creator.scores.potential.value, 1)}</div>
              {creator.scores.potential.value_lo !== undefined && creator.scores.potential.value_hi !== undefined && (
                <ConfidenceRange
                  value={creator.scores.potential.value}
                  lo={creator.scores.potential.value_lo}
                  hi={creator.scores.potential.value_hi}
                />
              )}
            </div>
            {creator.scores.resonance ? (
              <div className="space-y-4">
                {Object.entries(creator.scores.resonance).map(([productId, r]) => {
                  const product = productById.get(productId);
                  const breakdown = Object.entries(r.feature_breakdown).map(([name, value]) => ({ name, value }));
                  const contributions = r.contributions.map((c) => ({ name: c.dim, value: c.contribution }));
                  return (
                    <div key={productId} className="border border-white/10 rounded-lg p-3 transition-colors duration-300 hover:border-white/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-ink-100">{product?.name ?? productId}</span>
                        <span className="text-sm text-ink-100 font-semibold">R = {fmtNum(r.value, 1)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[11px] text-ink-400 mb-1">功能级共振（feature_breakdown）</div>
                          <div className="h-28">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={breakdown} layout="vertical" margin={{ left: 0, right: 8 }}>
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#8b8f9c" }} />
                                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "#8b8f9c" }} />
                                <Tooltip contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }} />
                                <Bar dataKey="value" fill="#ff8b26" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-ink-400 mb-1">语义维度 cosine 分维贡献</div>
                          <div className="h-28">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={contributions} layout="vertical" margin={{ left: 0, right: 8 }}>
                                <XAxis type="number" tick={{ fontSize: 10, fill: "#8b8f9c" }} />
                                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "#8b8f9c" }} />
                                <Tooltip contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }} />
                                <Bar dataKey="value" fill="#6b7280" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-ink-400 text-sm">共振分待计算——依赖视觉理解结果。</p>
            )}
          </Section>

          {/* Layer 5: 决策卡 */}
          <Section title="⑤ 决策卡（裂变层 · DeepSeek）">
            {creator.decision ? (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="px-2 py-1 rounded-md bg-accent/15 text-accent text-xs">
                    推荐单品：{productById.get(creator.decision.recommended_product)?.name ?? creator.decision.recommended_product}
                  </span>
                  <span className="text-xs text-ink-400">
                    综合分 combined = {fmtNum(creator.decision.combined_score, 2)}
                  </span>
                  {creator.decision.risk_review.competitor_flag && (
                    <span className="px-2 py-1 rounded-md bg-red-500/15 text-red-300 text-xs">
                      竞品风险：{creator.decision.risk_review.flagged_keywords.join(", ")}
                    </span>
                  )}
                </div>
                <p className="text-ink-100 leading-relaxed">{creator.decision.reasoning}</p>
                <div className="text-xs text-ink-400">
                  建议报价区间：
                  {creator.decision.price_range.min !== null
                    ? ` $${creator.decision.price_range.min} - $${creator.decision.price_range.max}`
                    : " 无法估算（订阅数隐藏）"}
                  {creator.decision.price_range.basis && ` · ${creator.decision.price_range.basis}`}
                </div>
                <div className="text-xs text-ink-400">{creator.decision.localization_notes}</div>
                {creator.decision.risk_review.competitor_flag && (
                  <p className="text-xs text-red-300/80">{creator.decision.risk_review.conclusion}</p>
                )}
              </div>
            ) : (
              <p className="text-ink-400 text-sm">未生成——决策卡仅对综合分 Top-60 预生成。</p>
            )}
          </Section>

          {/* Layer 6: 裂变 tab */}
          <Section title="⑥ 裂变（platform × language）">
            <ScriptsPanel creator={creator} />
          </Section>

          {/* Layer 7: 回流层 */}
          <Section title="⑦ 回流层（结果录入）">
            <OutcomeForm creator={creator} products={products} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={clsx("flex flex-col")}>
      <span className="text-[11px] text-ink-400">{label}</span>
      <span className="text-ink-100">{value}</span>
    </div>
  );
}

function ConfidenceRange({ value, lo, hi }: { value: number; lo: number; hi: number }) {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return (
    <div className="relative h-1.5 rounded-full bg-white/5 max-w-[240px]">
      <div
        className="absolute h-full rounded-full bg-accent/25"
        style={{ left: `${clamp(lo)}%`, width: `${clamp(hi) - clamp(lo)}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent"
        style={{ left: `${clamp(value)}%` }}
      />
    </div>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok_vertical: "TikTok 竖版",
  youtube_horizontal: "YouTube 横版",
};
const LANGUAGE_LABELS: Record<string, string> = { zh: "中文", en: "英文" };

function ScriptsPanel({ creator }: { creator: Creator }) {
  const scripts = creator.scripts;
  const [platform, setPlatform] = useState<"tiktok_vertical" | "youtube_horizontal">("tiktok_vertical");
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [copied, setCopied] = useState(false);

  if (scripts && scripts.length > 0) {
    const active = scripts.find((s) => s.platform === platform && s.language === language) ?? null;

    const asText = (s: NonNullable<typeof active>) =>
      `【${PLATFORM_LABELS[s.platform]} · ${LANGUAGE_LABELS[s.language]}】\n\n` +
      `钩子：${s.hook}\n\n` +
      `分镜：\n${s.storyboard_beats.map((b) => `- ${b}`).join("\n")}\n\n` +
      `口播要点：\n${s.voiceover_points.map((b) => `- ${b}`).join("\n")}\n\n` +
      `字幕文案：${s.caption_copy}\n\n` +
      `CTA：${s.cta_placement}`;

    return (
      <div className="space-y-3 text-sm">
        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-accent/15 text-accent">完整脚本</span>
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1 bg-white/5 rounded-md p-0.5">
            {(["tiktok_vertical", "youtube_horizontal"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={clsx(
                  "px-2.5 py-1 rounded text-xs transition-colors",
                  platform === p ? "bg-accent/20 text-accent" : "text-ink-400 hover:text-ink-100",
                )}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white/5 rounded-md p-0.5">
            {(["zh", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={clsx(
                  "px-2.5 py-1 rounded text-xs transition-colors",
                  language === l ? "bg-accent/20 text-accent" : "text-ink-400 hover:text-ink-100",
                )}
              >
                {LANGUAGE_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <div className="border border-white/10 rounded-lg p-3 space-y-2">
            <div>
              <div className="text-[11px] text-ink-400 mb-0.5">钩子（前3秒）</div>
              <p className="text-ink-100">{active.hook}</p>
            </div>
            <div>
              <div className="text-[11px] text-ink-400 mb-0.5">分镜要点</div>
              <ul className="list-disc list-inside text-xs text-ink-400 space-y-0.5">
                {active.storyboard_beats.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[11px] text-ink-400 mb-0.5">口播要点</div>
              <ul className="list-disc list-inside text-xs text-ink-400 space-y-0.5">
                {active.voiceover_points.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[11px] text-ink-400 mb-0.5">字幕文案</div>
              <p className="text-xs text-ink-400">{active.caption_copy}</p>
            </div>
            <div>
              <div className="text-[11px] text-ink-400 mb-0.5">CTA 落点</div>
              <p className="text-xs text-ink-400">{active.cta_placement}</p>
            </div>
            <div className="bg-white/5 rounded-md p-2 text-[11px] text-ink-600">
              引用真实数据：《{active.referenced_evidence.video_title}》 ·
              "{active.referenced_evidence.vision_evidence_quote}" · 卖点维度：{active.referenced_evidence.top_feature_breakdown_dim}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(asText(active));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="px-2.5 py-1 rounded-md border border-white/15 text-xs text-ink-100 hover:bg-white/5 transition-colors"
              >
                {copied ? "已复制" : "一键复制"}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([asText(active)], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${creator.title}_${active.platform}_${active.language}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-2.5 py-1 rounded-md border border-white/15 text-xs text-ink-100 hover:bg-white/5 transition-colors"
              >
                导出
              </button>
            </div>
          </div>
        ) : (
          <p className="text-ink-400 text-sm">该 platform × language 组合暂未生成。</p>
        )}
      </div>
    );
  }

  if (creator.decision && creator.decision.creative_variants.length > 0) {
    return (
      <div className="space-y-2 text-sm">
        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-white/5 text-ink-400 mb-1">
          脚本方向（轻量版，未进入 Top-20 完整脚本生成）
        </span>
        {creator.decision.creative_variants.map((variant) => (
          <div key={variant.variant_name} className="border border-white/10 rounded-lg p-3 transition-colors duration-300 hover:border-accent/30">
            <div className="font-medium text-ink-100 text-sm mb-1">{variant.variant_name}</div>
            <p className="text-ink-400 text-xs leading-relaxed mb-2">{variant.script_direction}</p>
            <ul className="list-disc list-inside text-xs text-ink-400 space-y-0.5 mb-2">
              {variant.subtitle_highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
            <div className="flex gap-3 text-[11px] text-ink-400">
              <span>{variant.target_platform_note}</span>
              <span>· 目标市场：{variant.target_market}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-ink-400 text-sm">未生成——裂变脚本仅对综合分 Top-60（轻量）/ Top-20（完整）预生成。</p>;
}

function OutcomeForm({ creator, products }: { creator: Creator; products: Product[] }) {
  const defaultProductId = creator.decision?.recommended_product ?? products[0]?.id ?? "";
  const [productId, setProductId] = useState(defaultProductId);
  const existing = getOutcome(creator.channel_id, productId);

  const [actualViews, setActualViews] = useState(existing?.actualViews?.toString() ?? "");
  const [engagementRate, setEngagementRate] = useState(existing?.engagementRate?.toString() ?? "");
  const [ignited, setIgnited] = useState(existing?.ignited ?? false);
  const [note, setNote] = useState(existing?.note ?? "");
  const [savedAt, setSavedAt] = useState(existing?.updatedAt ?? null);

  function handleProductChange(next: string) {
    setProductId(next);
    const o = getOutcome(creator.channel_id, next);
    setActualViews(o?.actualViews?.toString() ?? "");
    setEngagementRate(o?.engagementRate?.toString() ?? "");
    setIgnited(o?.ignited ?? false);
    setNote(o?.note ?? "");
    setSavedAt(o?.updatedAt ?? null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveOutcome(creator.channel_id, productId, {
      actualViews: Number(actualViews) || 0,
      engagementRate: Number(engagementRate) || 0,
      ignited,
      note,
    });
    setSavedAt(new Date().toISOString());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {products.length > 1 && (
        <div>
          <label className="text-[11px] text-ink-400 block mb-1">对应单品</label>
          <select
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="bg-[#12141b] border border-white/15 rounded-md text-sm px-2.5 py-1.5 text-ink-100"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-ink-400 block mb-1">实际播放量</label>
          <input
            type="number"
            min={0}
            value={actualViews}
            onChange={(e) => setActualViews(e.target.value)}
            className="w-full bg-[#12141b] border border-white/15 rounded-md text-sm px-2.5 py-1.5 text-ink-100 tabular-nums"
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-400 block mb-1">互动率 %</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={engagementRate}
            onChange={(e) => setEngagementRate(e.target.value)}
            className="w-full bg-[#12141b] border border-white/15 rounded-md text-sm px-2.5 py-1.5 text-ink-100 tabular-nums"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-ink-100 cursor-pointer">
        <input
          type="checkbox"
          checked={ignited}
          onChange={(e) => setIgnited(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        是否引爆
      </label>
      <div>
        <label className="text-[11px] text-ink-400 block mb-1">备注</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full bg-[#12141b] border border-white/15 rounded-md text-sm px-2.5 py-1.5 text-ink-100 resize-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-accent/15 text-accent text-xs border border-accent/40 hover:bg-accent/25 transition-colors"
        >
          保存结果
        </button>
        {savedAt && (
          <span className="text-[11px] text-ink-600">已保存 · {new Date(savedAt).toLocaleString("zh-CN")}</span>
        )}
      </div>
    </form>
  );
}
