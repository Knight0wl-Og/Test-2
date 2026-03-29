interface SkeletonRowProps {
  lines?: number;
  height?: string;
}

export function SkeletonRow({ lines = 1, height = 'h-4' }: SkeletonRowProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton ${height} w-full`} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-bg-card border border-border-dim rounded-lg p-4 space-y-3">
      <div className="skeleton h-3 w-16" />
      <div className="skeleton h-6 w-28" />
      <div className="skeleton h-3 w-20" />
    </div>
  );
}
