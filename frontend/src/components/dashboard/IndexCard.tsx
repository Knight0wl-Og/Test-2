import clsx from 'clsx';
import type { Quote } from '../../types';

interface IndexCardProps {
  quote: Quote;
  onClick?: () => void;
  selected?: boolean;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVolume(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function IndexCard({ quote, onClick, selected }: IndexCardProps) {
  const isPositive = quote.changePercent >= 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'bg-bg-card border rounded-lg p-3 text-left transition-all hover:border-accent/50 w-full shrink-0 min-w-[120px] lg:min-w-0',
        selected ? 'border-accent' : 'border-border-dim'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold text-gray-100 truncate">{quote.symbol}</div>
          <div className="text-xs text-text-muted truncate mt-0.5">{quote.shortName}</div>
        </div>
        <div
          className={clsx(
            'text-xs font-semibold px-1.5 py-0.5 rounded shrink-0',
            isPositive ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
          )}
        >
          {isPositive ? '+' : ''}{fmt(quote.changePercent)}%
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={clsx('text-base font-bold num text-white')}>
          {fmt(quote.price)}
        </span>
        <span className={clsx('text-xs num', isPositive ? 'text-green' : 'text-red')}>
          {isPositive ? '+' : ''}{fmt(quote.change)}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-xs text-text-muted">
        <span>Vol {fmtVolume(quote.volume)}</span>
        {quote.pe && <span>P/E {fmt(quote.pe, 1)}</span>}
      </div>
    </button>
  );
}

export function IndexCardSkeleton() {
  return (
    <div className="bg-bg-card border border-border-dim rounded-lg p-3 space-y-2 shrink-0 min-w-[120px] lg:min-w-0">
      <div className="flex justify-between">
        <div className="skeleton h-3 w-12" />
        <div className="skeleton h-4 w-14" />
      </div>
      <div className="skeleton h-6 w-24" />
      <div className="skeleton h-2.5 w-20" />
    </div>
  );
}
