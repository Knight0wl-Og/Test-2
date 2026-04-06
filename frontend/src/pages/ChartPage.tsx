/**
 * Mobile chart page — full-screen TV chart with compact symbol/timeframe strip.
 * Mirrors TradingView mobile: chart takes all available space, controls above it.
 */
import clsx from 'clsx';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { useQuote } from '../hooks/useQuotes';
import { TVChartWidget, type TVInterval } from '../components/chart/TVChartWidget';

type Timeframe = { label: string; tv: TVInterval };

const TIMEFRAMES: Timeframe[] = [
  { label: '1M',  tv: '1'   },
  { label: '5M',  tv: '5'   },
  { label: '15M', tv: '15'  },
  { label: '30M', tv: '30'  },
  { label: '1H',  tv: '60'  },
  { label: '4H',  tv: '240' },
  { label: '1D',  tv: 'D'   },
  { label: '1W',  tv: 'W'   },
];

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function ChartPage() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const symbol = selectedSymbol ?? 'AAPL';
  const { data: quote } = useQuote(symbol);
  const [interval, setInterval] = useState<TVInterval>('D');

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
              <span className={clsx('text-xs font-semibold num', isPos ? 'text-green' : 'text-red-400')}>
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

      {/* Timeframe strip */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-bg-secondary border-b border-panel overflow-x-auto no-scrollbar shrink-0">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.tv}
            onClick={() => setInterval(tf.tv)}
            className={clsx(
              'px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0',
              interval === tf.tv
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-gray-200 hover:bg-bg-hover'
            )}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Full-screen chart */}
      <div className="flex-1 min-h-0">
        <TVChartWidget
          symbol={symbol}
          interval={interval}
          onSymbolChange={(s) => useWatchlistStore.getState().selectSymbol(s)}
        />
      </div>
    </div>
  );
}
