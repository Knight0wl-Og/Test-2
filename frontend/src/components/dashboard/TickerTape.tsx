import { useQuery } from '@tanstack/react-query';
import { fetchBatchQuotes } from '../../services/api';
import { useWatchlistStore } from '../../store/watchlistStore';
import clsx from 'clsx';

export function TickerTape() {
  const allSymbols = useWatchlistStore((s) => s.allSymbols());

  const symbols = allSymbols.length > 0
    ? allSymbols.slice(0, 30) // cap at 30 for performance
    : ['SPY', 'QQQ', 'DIA', 'AAPL', 'MSFT', 'NVDA', 'META', 'AMZN', 'GOOGL', 'TSLA'];

  const { data: quotes = [] } = useQuery({
    queryKey: ['ticker-tape', symbols.join(',')],
    queryFn: () => fetchBatchQuotes(symbols),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (quotes.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...quotes, ...quotes];

  return (
    <div className="w-full overflow-hidden bg-bg-panel border-b border-border-dim/30 h-8 flex items-center">
      <div
        className="flex gap-6 whitespace-nowrap"
        style={{
          animation: `tickerScroll ${quotes.length * 3}s linear infinite`,
          width: 'max-content',
        }}
      >
        {items.map((q, i) => {
          const up = (q.changePercent ?? 0) >= 0;
          return (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-white">{q.symbol}</span>
              <span className="font-mono text-gray-300">${q.price?.toFixed(2) ?? '—'}</span>
              <span className={clsx('font-mono', up ? 'text-green-400' : 'text-red-400')}>
                {up ? '▲' : '▼'} {Math.abs(q.changePercent ?? 0).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>

      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
