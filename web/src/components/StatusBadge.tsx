import clsx from "clsx";
import type { ArchitectureLayerStatus } from "../lib/schema";

const STYLES: Record<ArchitectureLayerStatus, string> = {
  live: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  live_with_caveat: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pending: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const LABELS: Record<ArchitectureLayerStatus, string> = {
  live: "已上线",
  live_with_caveat: "已上线（有妥协）",
  pending: "待接入",
};

export function StatusBadge({ status }: { status: ArchitectureLayerStatus }) {
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-xs border", STYLES[status])}>
      {LABELS[status]}
    </span>
  );
}
