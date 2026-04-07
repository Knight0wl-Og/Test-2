/**
 * Mobile chart page — full-screen ProChart with compact symbol strip + options panel.
 */
import clsx from 'clsx';
import { useWatchlistStore } from '../store/watchlistStore';
import { useQuote } from '../hooks/useQuotes';
import { ProChart } from '../components/chart/ProChart';
import { OptionsPanel } from '../components/chart/OptionsPanel';
import { AnalystPanel } from '../components/chart/AnalystPanel';
import { InstitutionalPanel } from '../components/chart/InstitutionalPanel';

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function ChartPage() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const symbol = selectedSymbol ?? 'AAPL';
  const { data: quote } = useQuote(symbol);
  const isPos = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Compact symbol strip */}
      <div className="shrink-0 px-3 pt-2 pb-1 bg-bg-secondary border-b border-panel">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-white">{symbol}</span>
          {quote && (
            <>
              <span className="text-base font-bold text-white num">${fmt(quote.price)}</span>
              <span className={clsx('text-xs font-semibold num', isPos ? 'text-green-400' : 'text-red-400')}>
                {isPos ? '+' : ''}{fmt(quote.changePercent)}%
              </span>
            </>
          )}
        </div>
        {quote && (
          <div className="flex gap-3 text-[10px] text-text-muted mt-0.5">
            <span>O <span className="text-gray-400 num">{fmt(quote.open)}</span></span>
            <span>H <span className="text-gray-400 num">{fmt(quote.high)}</span></span>
            <span>L <span className="text-gray-400 num">{fmt(quote.low)}</span></span>
            <span>PC <span className="text-gray-400 num">{fmt(quote.previousClose)}</span></span>
          </div>
        )}
      </div>

      {/* Full-screen chart — ProChart owns its own timeframe + indicator controls */}
      <ProChart symbol={symbol} className="flex-1 min-h-0" />

      {/* Options panel at bottom */}
      <OptionsPanel symbol={symbol} underlyingPrice={quote?.price} />
      <AnalystPanel symbol={symbol} />
      <InstitutionalPanel symbol={symbol} />
    </div>
  );
}
