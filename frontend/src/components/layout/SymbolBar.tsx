import clsx from 'clsx';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useQuote } from '../../hooks/useQuotes';
import { useMarketStatus } from '../../hooks/useMarketData';

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtLarge(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  return n.toLocaleString();
}

export function SymbolBar() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const { data: quote } = useQuote(selectedSymbol);
  const { data: status } = useMarketStatus();
  const isOpen = status?.marketOpen ?? false;

  const isPos = (quote?.changePercent ?? 0) >= 0;

  if (!selectedSymbol || !quote) {
    return (
      <div className="h-9 bg-bg-secondary border-b border-panel flex items-center px-3 shrink-0">
        <span className="text-xs text-text-muted">Select a symbol to view data</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={clsx('w-1.5 h-1.5 rounded-full', isOpen ? 'bg-green animate-pulse' : 'bg-text-muted')} />
          <span className={clsx('text-[11px] font-medium', isOpen ? 'text-green' : 'text-text-muted')}>
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-9 bg-bg-secondary border-b border-panel flex items-center px-3 gap-3 overflow-x-auto no-scrollbar shrink-0">
      {/* Symbol + name */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-sm font-bold text-white">{quote.symbol}</span>
        <span className="text-[11px] text-text-muted hidden sm:inline truncate max-w-[140px]">{quote.shortName}</span>
      </div>

      {/* Price */}
      <span className="text-sm font-bold text-white num shrink-0">${fmt(quote.price)}</span>

      {/* Change */}
      <span className={clsx('text-xs font-semibold num shrink-0', isPos ? 'text-green' : 'text-red-400')}>
        {isPos ? '+' : ''}{fmt(quote.change)} ({isPos ? '+' : ''}{fmt(quote.changePercent)}%)
      </span>

      {/* OHLCV strip */}
      <div className="flex items-center gap-3 text-[11px] shrink-0">
        <span className="text-text-muted">O <span className="text-gray-300 num">{fmt(quote.open)}</span></span>
        <span className="text-text-muted">H <span className="text-gray-300 num">{fmt(quote.high)}</span></span>
        <span className="text-text-muted">L <span className="text-gray-300 num">{fmt(quote.low)}</span></span>
        <span className="text-text-muted">C <span className="text-gray-300 num">{fmt(quote.previousClose)}</span></span>
        {quote.volume > 0 && (
          <span className="text-text-muted hidden md:inline">Vol <span className="text-gray-300 num">{fmtLarge(quote.volume)}</span></span>
        )}
        {quote.marketCap && (
          <span className="text-text-muted hidden lg:inline">MCap <span className="text-gray-300">${fmtLarge(quote.marketCap)}</span></span>
        )}
      </div>

      {/* Market status — pushed right */}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <span className={clsx('w-1.5 h-1.5 rounded-full', isOpen ? 'bg-green animate-pulse' : 'bg-text-muted')} />
        <span className={clsx('text-[11px] font-medium', isOpen ? 'text-green' : 'text-text-muted')}>
          {isOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>
    </div>
  );
}
