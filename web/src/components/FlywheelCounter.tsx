import { useFlywheelCount } from "../lib/useFlywheelCount";

export default function FlywheelCounter({ channelCount }: { channelCount: number }) {
  const count = useFlywheelCount();
  return (
    <span className="text-xs text-ink-400 whitespace-nowrap">
      已回流 <span className="text-accent font-medium tabular-nums">{count}</span> 条 · 累计样本{" "}
      <span className="tabular-nums">{channelCount.toLocaleString()}+{count}</span> · 模型待迭代
    </span>
  );
}
