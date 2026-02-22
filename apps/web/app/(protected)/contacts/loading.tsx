export default function ContactsLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 animate-pulse bg-surface rounded-2xl" />
        <div className="h-10 w-32 animate-pulse bg-surface rounded-xl" />
      </div>
      {/* Birthday row */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 w-32 shrink-0 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
      {/* Contact cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
