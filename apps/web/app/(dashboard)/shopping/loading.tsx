export default function ShoppingLoading() {
  return (
    <div className="flex h-full gap-6 p-6">
      {/* Lists panel */}
      <div className="w-[280px] shrink-0 space-y-3">
        <div className="h-8 w-36 animate-pulse bg-surface rounded-2xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
      {/* Items panel */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse bg-surface rounded-2xl" />
          <div className="h-8 w-28 animate-pulse bg-surface rounded-xl" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse bg-surface rounded-xl" />
        ))}
      </div>
    </div>
  );
}
