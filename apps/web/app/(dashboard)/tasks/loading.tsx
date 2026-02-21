export default function TasksLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 animate-pulse bg-surface rounded-2xl" />
        <div className="h-10 w-28 animate-pulse bg-surface rounded-xl" />
      </div>
      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <div className="h-6 w-20 animate-pulse bg-surface rounded-lg" />
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className="h-24 animate-pulse bg-surface rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
