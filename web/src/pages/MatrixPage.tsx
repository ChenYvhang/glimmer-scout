import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useDataset } from "../lib/useDataset";
import { Loading } from "../components/Loading";
import ScatterMatrix, { type ScatterPlotPoint } from "../components/ScatterMatrix";
import FilterPanel, { type MatrixFilters } from "../components/FilterPanel";
import CandidatePoolPanel from "../components/CandidatePoolPanel";
import CompareModal from "../components/CompareModal";
import CreatorDrawer from "./CreatorDrawer";
import type { Creator } from "../lib/schema";
import { subscriberTierOf } from "../lib/subscriberTiers";
import { addToCandidatePool } from "../lib/candidatePool";
import { useCandidatePool } from "../lib/useCandidatePool";
import { useMatrixKeyboardShortcuts } from "../lib/keyboardShortcuts";

interface PlotPoint extends ScatterPlotPoint {
  hasDecision: boolean;
}

const EMPTY_FILTERS: MatrixFilters = { verticals: [], markets: [], tiers: [], hideRiskFlagged: false };
const ONBOARDING_KEY = "onboarding:matrixDismissed";
const MAX_COMPARE = 3;

export default function MatrixPage() {
  const { data, loading } = useDataset();
  const [productId, setProductId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MatrixFilters>(EMPTY_FILTERS);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === "1",
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { ids: poolIdList, budgetCap } = useCandidatePool();
  const poolIdSet = useMemo(() => new Set(poolIdList), [poolIdList]);

  const activeProductId = productId ?? data?.products[0]?.id ?? null;

  const verticals = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.creators.map((c) => c.vertical))).sort();
  }, [data]);

  const creatorsById = useMemo(() => {
    if (!data) return new Map<string, Creator>();
    return new Map(data.creators.map((c) => [c.channel_id, c]));
  }, [data]);

  const points: PlotPoint[] = useMemo(() => {
    if (!data || !activeProductId) return [];
    return data.creators
      .filter((c) => filters.verticals.length === 0 || filters.verticals.includes(c.vertical))
      .filter((c) => filters.markets.length === 0 || filters.markets.includes(c.market))
      .filter((c) => {
        if (filters.tiers.length === 0) return true;
        const tier = subscriberTierOf(c.subscriber_count);
        return tier !== null && filters.tiers.includes(tier);
      })
      .filter((c) => !filters.hideRiskFlagged || !c.decision?.risk_review.competitor_flag)
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.vertical.toLowerCase().includes(q) ||
          (c.vision?.sport_types.some((t) => t.toLowerCase().includes(q)) ?? false)
        );
      })
      .map((c): PlotPoint | null => {
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
          thumbnail: c.thumbnails[0],
          hasDecision: c.decision !== null,
        };
      })
      .filter((p): p is PlotPoint => p !== null)
      .sort((a, b) => b.combined - a.combined);
  }, [data, activeProductId, filters, search]);

  const selectedCreator: Creator | null = useMemo(() => {
    if (!data || !selectedChannelId) return null;
    return data.creators.find((c) => c.channel_id === selectedChannelId) ?? null;
  }, [data, selectedChannelId]);

  const compareCreators = useMemo(
    () => compareIds.map((id) => creatorsById.get(id)).filter((c): c is Creator => c !== undefined),
    [compareIds, creatorsById],
  );

  const visibleRows = points.slice(0, 60);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  useMatrixKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onEscape: () => {
      if (compareOpen) setCompareOpen(false);
      else if (selectedChannelId) setSelectedChannelId(null);
    },
    onMoveDown: () => setHighlightedIndex((i) => Math.min(i + 1, visibleRows.length - 1)),
    onMoveUp: () => setHighlightedIndex((i) => Math.max(i - 1, 0)),
    onOpenHighlighted: () => {
      const p = visibleRows[highlightedIndex];
      if (p) setSelectedChannelId(p.channel_id);
    },
  });

  if (loading || !data) return <Loading />;

  const activeProduct = data.products.find((p) => p.id === activeProductId);
  const visionCovered = data.meta.vision_coverage.analyzed ?? data.meta.vision_coverage.generated ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[32px] font-bold text-ink-100">引爆矩阵</h1>
          <p className="text-sm text-ink-400 mt-1">
            {data.meta.channel_count} 个频道 · 视觉理解覆盖 {visionCovered} · 决策卡覆盖{" "}
            {data.meta.decision_coverage.generated}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={activeProductId ?? ""}
            onChange={(e) => setProductId(e.target.value)}
            className="bg-[#12141b] border border-white/15 rounded-md text-sm px-3 py-1.5 text-ink-100 transition-colors duration-200 focus:outline-none focus:border-[var(--color-accent)]/60"
          >
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索达人名称…（/ 聚焦）"
            className="bg-[#12141b] border border-white/15 rounded-md text-sm px-3 py-1.5 text-ink-100 placeholder:text-ink-600 transition-colors duration-200 focus:outline-none focus:border-[var(--color-accent)]/60"
          />
        </div>
      </div>

      {activeProduct && (
        <p className="text-xs text-ink-400 mb-3">{activeProduct.description}</p>
      )}

      {!onboardingDismissed && (
        <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-md bg-white/[0.03] border border-white/10 text-xs text-ink-400">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white/10 text-ink-100">/</kbd> 聚焦搜索 ·{" "}
            <kbd className="px-1 py-0.5 rounded bg-white/10 text-ink-100">↑↓</kbd>+
            <kbd className="px-1 py-0.5 rounded bg-white/10 text-ink-100">Enter</kbd> 移动并打开 ·{" "}
            <kbd className="px-1 py-0.5 rounded bg-white/10 text-ink-100">Esc</kbd> 关闭 ·
            散点图拖拽框选批量加入候选池 · 勾选榜单最多3人对比
          </span>
          <button
            onClick={() => {
              localStorage.setItem(ONBOARDING_KEY, "1");
              setOnboardingDismissed(true);
            }}
            className="shrink-0 text-ink-600 hover:text-ink-100"
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-4 items-start">
        <FilterPanel
          verticals={verticals}
          dataSources={data.meta.data_sources}
          filters={filters}
          onChange={setFilters}
        />

        <div className="min-w-0">
          <ScatterMatrix
            points={points}
            onSelect={setSelectedChannelId}
            poolIds={poolIdSet}
            onBoxSelect={addToCandidatePool}
          />

          <div className="mt-6">
            <h2 className="text-xl font-medium text-ink-100 mb-2">
              排名（按 √(P×R) 综合分，共 {points.length} 个已覆盖视觉理解的候选）
            </h2>
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-ink-400 text-xs">
                  <tr>
                    <th className="text-center px-3 py-2 font-medium">对比</th>
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
                  {visibleRows.map((p, i) => (
                    <tr
                      key={p.channel_id}
                      onClick={() => setSelectedChannelId(p.channel_id)}
                      className={clsx(
                        "border-t border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors duration-150",
                        i === highlightedIndex && "bg-white/[0.05]",
                      )}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={compareIds.includes(p.channel_id)}
                          disabled={!compareIds.includes(p.channel_id) && compareIds.length >= MAX_COMPARE}
                          onChange={() => toggleCompare(p.channel_id)}
                          className="accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className="px-3 py-2 text-ink-100 max-w-[220px] truncate">{p.title}</td>
                      <td className="px-3 py-2 text-ink-400">{p.vertical}</td>
                      <td className="px-3 py-2 text-right text-accent">{p.potential.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-ink-100">{p.resonance.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-ink-100">{p.combined.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-ink-400">{p.subscriber_count.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={clsx(
                            "inline-block w-2 h-2 rounded-full",
                            p.hasDecision ? "bg-accent shadow-[0_0_5px_1px_rgba(255,139,38,0.6)]" : "bg-gray-700",
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {points.length === 0 && (
                <p className="text-center text-ink-400 text-sm py-8">
                  当前筛选条件下没有已完成视觉理解的候选，试试切换单品或调整左侧筛选。
                </p>
              )}
            </div>
          </div>
        </div>

        <CandidatePoolPanel
          poolIds={poolIdList}
          budgetCap={budgetCap}
          creatorsById={creatorsById}
          onSelect={setSelectedChannelId}
        />
      </div>

      {compareIds.length >= 2 && !compareOpen && (
        <div className="fixed bottom-6 right-6 z-30 flex items-center gap-3 bg-[#1a1c24] border border-white/15 rounded-full pl-4 pr-2 py-2 shadow-2xl animate-fade-in-up">
          <span className="text-sm text-ink-100">已选 {compareIds.length} 人对比</span>
          <button
            onClick={() => setCompareOpen(true)}
            className="px-3 py-1.5 rounded-full bg-accent/15 text-accent text-xs border border-accent/40 hover:bg-accent/25 transition-colors"
          >
            打开对比
          </button>
          <button
            onClick={() => setCompareIds([])}
            className="text-ink-400 hover:text-ink-100 text-sm px-1"
            aria-label="清空对比"
          >
            ×
          </button>
        </div>
      )}

      {compareOpen && compareCreators.length >= 2 && (
        <CompareModal
          creators={compareCreators}
          activeProductId={activeProductId}
          products={data.products}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        />
      )}

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
