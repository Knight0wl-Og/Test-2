interface LoadingStateProps {
  rows?: number;
  variant?: 'rows' | 'cards' | 'table';
}

export function LoadingState({ rows = 5, variant = 'rows' }: LoadingStateProps) {
  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-24 bg-bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-1">
        <div className="h-8 bg-bg-card rounded animate-pulse" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-bg-card/60 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-bg-card rounded animate-pulse" />
      ))}
    </div>
  );
}
