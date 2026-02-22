export default function CalendarLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-10 w-20 animate-pulse bg-surface rounded-xl" />
          <div className="h-10 w-20 animate-pulse bg-surface rounded-xl" />
          <div className="h-10 w-20 animate-pulse bg-surface rounded-xl" />
        </div>
        <div className="h-10 w-28 animate-pulse bg-surface rounded-xl" />
      </div>
      {/* Calendar grid */}
      <div className="h-[600px] animate-pulse bg-surface rounded-2xl" />
    </div>
  );
}
