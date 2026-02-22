export default function FinancesLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
      {/* Bill grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
