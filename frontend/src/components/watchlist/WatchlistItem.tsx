import clsx from 'clsx';
import { X } from 'lucide-react';
import type { Quote } from '../../types';

interface WatchlistItemProps {
  symbol: string;
  quote?: Quote;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function WatchlistItem({ symbol, quote, selected, onSelect, onRemove }: WatchlistItemProps) {
  const isPos = (quote?.changePercent ?? 0) >= 0;

  return (
    <div
      className={clsx(
        'group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
        selected ? 'bg-accent/10' : 'hover:bg-bg-hover'
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={clsx('text-xs font-bold', selected ? 'text-accent' : 'text-gray-100')}>
            {symbol}
          </span>
          {quote && (
            <span className="text-xs text-text-muted truncate hidden group-hover:hidden">
              {quote.shortName?.slice(0, 15)}
            </span>
          )}
        </div>
        {quote ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs num text-gray-300">{fmt(quote.price)}</span>
            <span className={clsx('text-xs num', isPos ? 'text-green' : 'text-red')}>
              {isPos ? '+' : ''}{fmt(quote.changePercent)}%
            </span>
          </div>
        ) : (
          <div className="flex gap-1 mt-0.5">
            <div className="skeleton h-2.5 w-12" />
            <div className="skeleton h-2.5 w-10" />
          </div>
        )}
      </div>

      {/* Remove button — shown on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red transition-all shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
