interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface rounded-2xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface rounded-lg h-4 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`glass-card rounded-2xl p-6 space-y-3 ${className}`} aria-hidden="true">
      <div className="animate-pulse bg-surface rounded-lg h-5 w-2/3" />
      <div className="animate-pulse bg-surface rounded-lg h-4 w-full" />
      <div className="animate-pulse bg-surface rounded-lg h-4 w-4/5" />
    </div>
  );
}
