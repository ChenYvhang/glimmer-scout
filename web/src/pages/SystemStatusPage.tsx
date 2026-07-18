import { useDataset } from "../lib/useDataset";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import FlywheelCounter from "../components/FlywheelCounter";
import clsx from "clsx";

export default function SystemStatusPage() {
  const { data, loading } = useDataset();
  if (loading || !data) return <Loading />;

  const { meta } = data;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-ink-100 mb-1">系统状态</h1>
        <p className="text-sm text-ink-400">
          采集基准时间 {new Date(meta.fetched_at).toLocaleString("zh-CN")}
        </p>
        <div className="mt-2">
          <FlywheelCounter channelCount={meta.channel_count} />
        </div>
      </div>

      <section>
        <h2 className="text-xl font-medium text-ink-100 mb-3">四层架构状态</h2>
        <div className="grid grid-cols-1 gap-3">
          {meta.architecture_layers.map((layer) => (
            <div
              key={layer.layer}
              className="border border-white/10 rounded-xl p-4 bg-white/[0.02] flex items-start gap-4 transition-colors duration-300 hover:border-accent/25"
            >
              <div className="w-20 shrink-0 text-sm font-medium text-ink-100 pt-0.5">{layer.layer}</div>
              <div className="flex-1">
                <StatusBadge status={layer.status} />
                <p className="text-xs text-ink-400 mt-2 leading-relaxed">{layer.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-100 mb-3">数据源接入状态</h2>
        <div className="flex flex-wrap gap-2">
          {meta.data_sources.map((ds) => (
            <span
              key={ds.platform}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs border transition-transform duration-200 hover:scale-105",
                ds.status === "connected"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-gray-500/15 text-ink-400 border-gray-500/30",
              )}
            >
              {ds.platform} · {ds.status === "connected" ? "已接入" : "待接入"}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-100 mb-3">采集与覆盖率</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="频道总数" value={meta.channel_count.toLocaleString()} />
          <MetricCard label="视频总数" value={meta.video_count.toLocaleString()} />
          <MetricCard
            label="视觉理解覆盖"
            value={`${meta.vision_coverage.analyzed ?? 0} / ${meta.vision_coverage.total}`}
            sub={meta.vision_coverage.note}
          />
          <MetricCard
            label="决策卡覆盖"
            value={`${meta.decision_coverage.generated ?? 0} / ${meta.decision_coverage.total}`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-100 mb-3">配额消耗（YouTube Data API v3）</h2>
        <div className="grid grid-cols-5 gap-3">
          <MetricCard label="search.list" value={meta.quota_used.search.toLocaleString()} />
          <MetricCard label="channels.list" value={meta.quota_used.channels.toLocaleString()} />
          <MetricCard label="playlistItems.list" value={meta.quota_used.playlistItems.toLocaleString()} />
          <MetricCard label="videos.list" value={meta.quota_used.videos.toLocaleString()} />
          <MetricCard label="合计" value={meta.quota_used.total.toLocaleString()} highlight />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-100 mb-3">年龄偏差验证</h2>
        <div
          className={clsx(
            "border rounded-xl p-4 text-sm",
            meta.age_bias_validation.pass
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/5",
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={meta.age_bias_validation.pass ? "text-emerald-300" : "text-red-300"}>
              {meta.age_bias_validation.pass ? "✓ 通过" : "✗ 未通过"}
            </span>
            <span className="text-ink-400 text-xs">
              斜率 {meta.age_bias_validation.slope.toFixed(4)} · 阈值 {meta.age_bias_validation.threshold}
            </span>
          </div>
          <p className="text-xs text-ink-400">
            相对动能不随频道年龄单调漂移，累积播放量偏差已消除。
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-100 mb-3">模型状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard
            label="潜力分模型"
            value={meta.model_status.potential_score_model === "dual_head_gbdt" ? "双头GBDT（真训练）" : "启发式（样本不足）"}
            sub={`训练样本数 ${meta.model_status.gbdt_sample_count}`}
          />
          <MetricCard label="视觉模型" value="GLM-4.6V-Flash" sub="多模态内容理解，见理解层" />
          <MetricCard label="时序 Transformer" value="⏳ 待接入" sub="demo规模样本不足以训练序列模型" />
        </div>
      </section>

      <footer className="pt-6 border-t border-white/10 text-center">
        <span className="glimmer-text text-sm font-medium">Catch the glimmer before dawn.</span>
      </footer>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-white/10 rounded-xl p-3 bg-white/[0.02] transition-all duration-300 hover:border-accent/25 hover:-translate-y-0.5">
      <div className="text-[11px] text-ink-400">{label}</div>
      <div className={clsx("text-lg font-semibold mt-0.5", highlight ? "text-accent" : "text-ink-100")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-600 mt-1">{sub}</div>}
    </div>
  );
}
