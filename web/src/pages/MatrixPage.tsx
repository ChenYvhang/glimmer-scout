import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import clsx from "clsx";
import { useDataset } from "../lib/useDataset";
import { Loading } from "../components/Loading";
import CreatorDrawer from "./CreatorDrawer";
import type { Creator } from "../lib/schema";

interface PlotPoint {
  channel_id: string;
  title: string;
  vertical: string;
  potential: number;
  resonance: number;
  combined: number;
  subscriber_count: number;
  hasDecision: boolean;
}

export default function MatrixPage() {
  const { data, loading } = useDataset();
  const [productId, setProductId] = useState<string | null>(null);
  const [vertical, setVertical] = useState<string>("全部");
  const [search, setSearch] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const activeProductId = productId ?? data?.products[0]?.id ?? null;

  const verticals = useMemo(() => {
    if (!data) return [];
    return ["全部", ...Array.from(new Set(data.creators.map((c) => c.vertical))).sort()];
  }, [data]);

  const points: PlotPoint[] = useMemo(() => {
    if (!data || !activeProductId) return [];
    return data.creators
      .filter((c) => vertical === "全部" || c.vertical === vertical)
      .filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()))
      .map((c) => {
        const r = c.scores.resonance?.[activeProductId];
        if (!r) return null;
        const potential = c.scores.potential.value;
        return {
          channel_id: c.channel_id,
          title: c.title,
          vertical: c.vertical,
          potential,
          resonance: r.value,
          combined: Math.sqrt(Math.max(potential, 0) * Math.max(r.value, 0)),
          subscriber_count: c.subscriber_count,
          hasDecision: c.decision !== null,
        } satisfies PlotPoint;
      })
      .filter((p): p is PlotPoint => p !== null)
      .sort((a, b) => b.combined - a.combined);
  }, [data, activeProductId, vertical, search]);

  const selectedCreator: Creator | null = useMemo(() => {
    if (!data || !selectedChannelId) return null;
    return data.creators.find((c) => c.channel_id === selectedChannelId) ?? null;
  }, [data, selectedChannelId]);

  if (loading || !data) return <Loading />;

  const activeProduct = data.products.find((p) => p.id === activeProductId);
  const visionCovered = data.meta.vision_coverage.analyzed ?? data.meta.vision_coverage.generated ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">引爆矩阵</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.meta.channel_count} 个频道 · 视觉理解覆盖 {visionCovered} · 决策卡覆盖{" "}
            {data.meta.decision_coverage.generated}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={activeProductId ?? ""}
            onChange={(e) => setProductId(e.target.value)}
            className="bg-[#12141b] border border-white/15 rounded-md text-sm px-3 py-1.5 text-gray-200"
          >
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="bg-[#12141b] border border-white/15 rounded-md text-sm px-3 py-1.5 text-gray-200"
          >
            {verticals.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索达人名称…"
            className="bg-[#12141b] border border-white/15 rounded-md text-sm px-3 py-1.5 text-gray-200 placeholder:text-gray-600"
          />
        </div>
      </div>

      {activeProduct && (
        <p className="text-xs text-gray-500 mb-3">{activeProduct.description}</p>
      )}

      <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#232631" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="potential"
                name="潜力分 P"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#8b8f9c" }}
                label={{ value: "潜力分 P", position: "insideBottom", offset: -4, fill: "#6b7280", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="resonance"
                name="共振分 R"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#8b8f9c" }}
                label={{ value: "共振分 R", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="subscriber_count" range={[30, 400]} name="订阅数" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ background: "#1a1c24", border: "1px solid #333844", fontSize: 12 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as PlotPoint;
                  return (
                    <div className="bg-[#1a1c24] border border-white/15 rounded-md px-3 py-2 text-xs">
                      <div className="font-medium text-gray-100">{p.title}</div>
                      <div className="text-gray-400">{p.vertical}</div>
                      <div className="text-gray-400">P={p.potential.toFixed(1)} R={p.resonance.toFixed(1)}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={points}
                fillOpacity={0.75}
                onClick={(p) => setSelectedChannelId((p as unknown as PlotPoint).channel_id)}
                cursor="pointer"
              >
                {points.map((p) => (
                  <Cell key={p.channel_id} fill={p.hasDecision ? "#c98500" : "#0284c7"} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-glimmer-400 inline-block" /> 已生成决策卡
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-signal-400 inline-block" /> 仅有匹配分
          </span>
          <span>圆点大小 = 订阅数</span>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">
          排名（按 √(P×R) 综合分，共 {points.length} 个已覆盖视觉理解的候选）
        </h2>
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-gray-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">达人</th>
                <th className="text-left px-3 py-2 font-medium">垂类</th>
                <th className="text-right px-3 py-2 font-medium">P</th>
                <th className="text-right px-3 py-2 font-medium">R</th>
                <th className="text-right px-3 py-2 font-medium">综合分</th>
                <th className="text-right px-3 py-2 font-medium">订阅数</th>
                <th className="text-center px-3 py-2 font-medium">决策卡</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(0, 60).map((p) => (
                <tr
                  key={p.channel_id}
                  onClick={() => setSelectedChannelId(p.channel_id)}
                  className="border-t border-white/5 hover:bg-white/[0.04] cursor-pointer"
                >
                  <td className="px-3 py-2 text-gray-200 max-w-[220px] truncate">{p.title}</td>
                  <td className="px-3 py-2 text-gray-500">{p.vertical}</td>
                  <td className="px-3 py-2 text-right text-glimmer-300">{p.potential.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-sky-300">{p.resonance.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-gray-200">{p.combined.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{p.subscriber_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={clsx(
                        "inline-block w-2 h-2 rounded-full",
                        p.hasDecision ? "bg-glimmer-400" : "bg-gray-700",
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {points.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              当前筛选条件下没有已完成视觉理解的候选，试试切换单品或垂类。
            </p>
          )}
        </div>
      </div>

      {selectedCreator && (
        <CreatorDrawer
          creator={selectedCreator}
          products={data.products}
          onClose={() => setSelectedChannelId(null)}
        />
      )}
    </div>
  );
}
