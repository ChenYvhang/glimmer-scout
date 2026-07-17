import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDataset } from "../lib/useDataset";
import { Loading } from "../components/Loading";

export default function BacktestPage() {
  const { data, loading } = useDataset();
  if (loading || !data) return <Loading />;

  const { backtest, potential_model } = data;
  const chartData = [
    { name: backtest.baseline.name, hit_rate: backtest.baseline.hit_rate * 100, kind: "baseline" },
    { name: backtest.nextscout.name, hit_rate: backtest.nextscout.hit_rate * 100, kind: "nextscout" },
  ];

  const aucIsWeak = potential_model.holdout_metrics.auc < 0.6;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-white mb-1">回测对照</h1>
      <p className="text-sm text-gray-500 mb-6">{backtest.method}</p>

      <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] mb-6">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 20, top: 10 }}>
              <CartesianGrid stroke="#232631" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8b8f9c" }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#8b8f9c" }}
                label={{ value: "Top-20 命中率 %", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }}
                formatter={(v) => `${Number(v).toFixed(1)}%`}
              />
              <Bar dataKey="hit_rate" radius={[6, 6, 0, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.kind} fill={d.kind === "nextscout" ? "#c98500" : "#4b5563"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-8 text-sm">
          <Metric label="基线命中率" value={`${(backtest.baseline.hit_rate * 100).toFixed(0)}%`} />
          <Metric label="Glimmer Scout命中率" value={`${(backtest.nextscout.hit_rate * 100).toFixed(0)}%`} highlight />
          <Metric label="Lift" value={`${backtest.lift.toFixed(1)}×`} highlight />
          <Metric label="有效样本数" value={`${backtest.eligible_channel_count}`} />
        </div>
      </div>

      <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">GBDT 潜力分模型 · Holdout 指标</h2>
        <div className="grid grid-cols-4 gap-4 text-sm mb-3">
          <Metric label="训练样本数" value={`${potential_model.training_sample_count}`} />
          <Metric label="正例占比" value={`${(potential_model.positive_label_rate * 100).toFixed(1)}%`} />
          <Metric label="Accuracy" value={potential_model.holdout_metrics.accuracy.toFixed(3)} />
          <Metric
            label="AUC"
            value={potential_model.holdout_metrics.auc.toFixed(3)}
            highlight={aucIsWeak}
            warn={aucIsWeak}
          />
        </div>
        {aucIsWeak && (
          <p className="text-xs text-amber-300/90 bg-amber-500/10 rounded-md p-3 leading-relaxed">
            AUC={potential_model.holdout_metrics.auc.toFixed(3)} 接近随机（0.5），如实报告不回避：demo
            规模（{potential_model.training_sample_count}样本、正例占比{" "}
            {(potential_model.positive_label_rate * 100).toFixed(1)}%）下 GBDT 的排序判别力有限，Top-20
            命中率的提升更多来自潜力分对头部候选的排序效果，而非模型整体判别力强。
          </p>
        )}
        <div className="mt-4">
          <h3 className="text-xs font-medium text-gray-400 mb-2">特征重要性（Top 8）</h3>
          <div className="space-y-1.5">
            {potential_model.feature_importance.slice(0, 8).map((f) => {
              const maxAbs = Math.max(...potential_model.feature_importance.map((x) => Math.abs(x.contribution)));
              const widthPct = maxAbs > 0 ? (Math.abs(f.contribution) / maxAbs) * 100 : 0;
              return (
                <div key={f.feature} className="flex items-center gap-2 text-xs">
                  <span className="w-48 shrink-0 text-gray-400 truncate">{f.feature}</span>
                  <div className="flex-1 bg-white/5 rounded h-3 overflow-hidden">
                    <div
                      className={f.contribution >= 0 ? "bg-glimmer-400 h-full" : "bg-signal-400 h-full"}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-gray-500">{f.contribution.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div
        className={
          warn
            ? "text-lg font-semibold text-amber-300"
            : highlight
              ? "text-lg font-semibold text-glimmer-300"
              : "text-lg font-semibold text-gray-200"
        }
      >
        {value}
      </div>
    </div>
  );
}
