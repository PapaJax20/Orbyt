export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
      {/* Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
