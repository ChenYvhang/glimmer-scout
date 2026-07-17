import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useDataset } from "../lib/useDataset";
import { Loading } from "../components/Loading";
import type { BacktestTier, TopKResult } from "../lib/schema";

// 网页只展示 Top-20 与 Top-100 两档（K=10/50 仍在 dataset.json 里，供之后需要时取用）
const DISPLAY_K: Array<"20" | "100"> = ["20", "100"];

// score.py FEATURE_NAMES 的中文对照，仅用于展示——数据里的字段名保持英文不变，
// 避免图表标签换行/截断，同时不引入"中英文字段名两套真相"的维护负担。
const FEATURE_LABELS: Record<string, string> = {
  video_count_in_window: "窗口内视频数",
  publish_interval_mean_days: "发布间隔均值（天）",
  publish_interval_std_days: "发布间隔波动（天）",
  engagement_like_ratio_mean: "点赞率均值",
  engagement_comment_ratio_mean: "评论率均值",
  relative_velocity_mean: "相对动能均值",
  relative_velocity_std: "相对动能波动",
  channel_age_days_at_window_end: "频道年龄（窗口末，天）",
  window_momentum_acceleration: "窗口内动能加速度",
  season_adjusted_relative_velocity_mean: "季节调整后动能均值",
};

export default function BacktestPage() {
  const { data, loading } = useDataset();
  if (loading || !data) return <Loading />;

  const { backtest, potential_model } = data;
  const global = backtest.tiers.find((t) => t.tier === "global")!;
  const tiers = backtest.tiers.filter((t) => t.tier !== "global");

  const kScanData = DISPLAY_K.map((k) => ({
    k: `Top-${k}`,
    baseline: global.per_k[k].baseline_hit_rate * 100,
    model: global.per_k[k].model_hit_rate * 100,
  }));

  const calibrationPoints =
    potential_model.calibration?.calibration_curve
      .filter((b) => b.n > 0)
      .map((b) => ({ x: b.mean_predicted! * 100, y: b.observed_frequency! * 100, n: b.n })) ?? [];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">回测对照</h1>
        <p className="text-sm text-gray-500">
          评估口径：训练用滑动切分点（切分前 30/60/90/120/150 天）扩充样本，评估固定切分点前 60 天的单一快照，
          避免同一频道在榜单里重复计数。
          标签口径：切分点后视频相对动能的中位数，相对切分点前中位数的涨幅 ≥{" "}
          {potential_model.label_threshold.threshold_used} 倍
          {potential_model.label_threshold.relaxed ? "（默认 1.5 倍下正样本率不足 5%，已自动放宽）" : ""}
          ，且切分点后 ≥50% 的视频个体表现都超过切分点前中位数，两者同时满足才算"加速"。
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          分层 Top-20 / Top-100 命中率（按订阅数分层，剥夺基线"靠体量躺赢"的优势）
        </h2>
        <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-gray-400 text-xs">
              <tr>
                <th rowSpan={2} className="text-left px-3 py-2 align-bottom">分层</th>
                <th rowSpan={2} className="text-right px-3 py-2 align-bottom">候选数</th>
                <th rowSpan={2} className="text-right px-3 py-2 align-bottom">正样本数</th>
                <th colSpan={3} className="text-center px-3 py-1 border-l border-white/5">Top-20</th>
                <th colSpan={3} className="text-center px-3 py-1 border-l border-white/5">Top-100</th>
              </tr>
              <tr>
                <th className="text-right px-3 py-1 border-l border-white/5">baseline</th>
                <th className="text-right px-3 py-1">模型</th>
                <th className="text-right px-3 py-1">lift</th>
                <th className="text-right px-3 py-1 border-l border-white/5">baseline</th>
                <th className="text-right px-3 py-1">模型</th>
                <th className="text-right px-3 py-1">lift</th>
              </tr>
            </thead>
            <tbody>
              <TierRow tier={global} highlight />
              {tiers.map((t) => (
                <TierRow key={t.tier} tier={t} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          "样本不足"的分层仅供参考，不计入结论；&lt;1K 订阅频道（{backtest.excluded_below_1k_count} 个）不参与分层，只计入 global 行。
        </p>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          global 的 lift 明显高于各分层，是因为按订阅数排序的 baseline Top-20 几乎全部落在体量最大的一档，
          而模型排序不受体量限制，能优先选出更容易加速的中小频道——这体现的是"能否挖到潜力新星"，
          而不是"同量级内谁排得更准"；后者要看上方各分层各自的 lift。
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Top-20 vs Top-100（global）</h2>
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kScanData} margin={{ left: 0, right: 20, top: 10 }}>
                <CartesianGrid stroke="#232631" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="k" tick={{ fontSize: 12, fill: "#8b8f9c" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8b8f9c" }} label={{ value: "命中率 %", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Bar dataKey="baseline" name="baseline" fill="#4b5563" radius={[4, 4, 0, 0]} />
                <Bar dataKey="model" name="模型" fill="#c98500" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          {potential_model.method === "dual_head_gbdt" ? "双头模型（排序头 + 概率头）" : "启发式打分"} · 校准与置信区间
        </h2>
        <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Metric label="训练样本数" value={`${potential_model.training_sample_count}`} />
            <Metric label="正例占比" value={`${((potential_model.positive_label_rate ?? 0) * 100).toFixed(1)}%`} />
            {potential_model.calibration && (
              <Metric label="Brier score" value={potential_model.calibration.brier_score.toFixed(4)} />
            )}
          </div>
          {potential_model.calibration && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 mb-2">
                Isotonic 校准曲线（校准集：未参与训练的独立频道，n={potential_model.calibration.n_calibration_rows}） · Conformal
                目标覆盖率 {(potential_model.calibration.target_coverage * 100).toFixed(0)}% · 实际覆盖率{" "}
                {potential_model.calibration.actual_coverage !== null
                  ? `${(potential_model.calibration.actual_coverage * 100).toFixed(1)}%`
                  : "n/a"}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid stroke="#232631" strokeDasharray="3 3" />
                    <XAxis
                      type="number" dataKey="x" domain={[0, 100]} tick={{ fontSize: 11, fill: "#8b8f9c" }}
                      label={{ value: "预测概率 %（校准后）", position: "insideBottom", offset: -5, fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis
                      type="number" dataKey="y" domain={[0, 100]} tick={{ fontSize: 11, fill: "#8b8f9c" }}
                      label={{ value: "实际发生频率 %", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }}
                    />
                    <ZAxis type="number" dataKey="n" range={[40, 240]} />
                    <Tooltip
                      contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }}
                      formatter={(v, name) => [name === "n" ? `${v}` : `${Number(v).toFixed(1)}%`, `${name}`]}
                    />
                    <Line
                      type="linear" dataKey="y" data={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                      stroke="#4b5563" strokeDasharray="4 4" dot={false} legendType="none" activeDot={false}
                    />
                    <Scatter data={calibrationPoints} fill="#c98500" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-600 mt-1">气泡大小 = 该分箱样本数；越贴近对角虚线，校准越准。</p>
            </div>
          )}
        </div>
      </section>

      {potential_model.feature_importance && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-1">特征重要性（可解释性）</h2>
          <p className="text-xs text-gray-600 mb-3">{potential_model.feature_importance.method}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureImportanceChart
              title="排序头（LGBMRanker，决定 Top-K 榜单顺序）"
              entries={potential_model.feature_importance.ranker}
            />
            <FeatureImportanceChart
              title="概率头（LGBMRegressor，决定引爆概率数值）"
              entries={potential_model.feature_importance.regressor}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function FeatureImportanceChart({ title, entries }: { title: string; entries: { feature: string; importance: number }[] }) {
  const top = entries.slice(0, 8);
  const maxImportance = Math.max(...top.map((e) => e.importance), 1);
  return (
    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
      <h3 className="text-xs font-medium text-gray-400 mb-3">{title}</h3>
      <div className="space-y-1.5">
        {top.map((e) => (
          <div key={e.feature} className="flex items-center gap-2 text-xs">
            <span className="w-48 shrink-0 text-gray-400 truncate">{FEATURE_LABELS[e.feature] ?? e.feature}</span>
            <div className="flex-1 bg-white/5 rounded h-3 overflow-hidden">
              <div className="bg-glimmer-400 h-full" style={{ width: `${(e.importance / maxImportance) * 100}%` }} />
            </div>
            <span className="w-14 text-right text-gray-500">{e.importance.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierRow({ tier, highlight }: { tier: BacktestTier; highlight?: boolean }) {
  const k20 = tier.per_k["20"];
  const k100 = tier.per_k["100"];
  return (
    <tr className={highlight ? "bg-glimmer-500/5 font-medium" : "border-t border-white/5"}>
      <td className="px-3 py-2 text-gray-200">{tier.tier === "global" ? "全局" : tier.tier}</td>
      <td className="px-3 py-2 text-right text-gray-400">{tier.n_candidates}</td>
      <td className="px-3 py-2 text-right text-gray-400">{tier.n_positive}</td>
      <KCells k={k20} insufficient={tier.insufficient_sample} borderLeft />
      <KCells k={k100} insufficient={tier.insufficient_sample} borderLeft />
    </tr>
  );
}

function KCells({ k, insufficient, borderLeft }: { k: TopKResult; insufficient: boolean; borderLeft?: boolean }) {
  const border = borderLeft ? "border-l border-white/5" : "";
  return (
    <>
      <td className={`px-3 py-2 text-right text-gray-400 ${border}`}>{(k.baseline_hit_rate * 100).toFixed(1)}%</td>
      <td className="px-3 py-2 text-right text-gray-200">{(k.model_hit_rate * 100).toFixed(1)}%</td>
      <td className="px-3 py-2 text-right">
        {insufficient ? (
          <span className="text-gray-600 text-xs">样本不足</span>
        ) : (
          <span className="text-glimmer-300">{k.lift !== null ? `${k.lift.toFixed(2)}×` : "n/a"}</span>
        )}
      </td>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-200">{value}</div>
    </div>
  );
}
