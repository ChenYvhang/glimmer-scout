export function Loading({ label = "加载数据中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-gray-500 text-sm gap-2">
      <span className="inline-block w-3 h-3 rounded-full border-2 border-fuchsia-400 border-t-transparent animate-spin" />
      {label}
    </div>
  );
}
