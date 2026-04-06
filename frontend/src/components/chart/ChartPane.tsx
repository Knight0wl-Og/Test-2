import { useState } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useWatchlistStore } from '../../store/watchlistStore';
import { TVChartWidget, toTVInterval, type TVInterval } from './TVChartWidget';

type Timeframe = '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

const TIMEFRAMES: { label: string; tf: Timeframe; tv: TVInterval }[] = [
  { label: '5M',  tf: '5m',  tv: '5'   },
  { label: '15M', tf: '15m', tv: '15'  },
  { label: '30M', tf: '30m', tv: '30'  },
  { label: '1H',  tf: '1h',  tv: '60'  },
  { label: '4H',  tf: '4h',  tv: '240' },
  { label: '1D',  tf: '1d',  tv: 'D'   },
  { label: '1W',  tf: '1w',  tv: 'W'   },
];

interface ChartPaneProps {
  /** Initial symbol for this pane */
  defaultSymbol?: string;
  /** Whether to show the pane header (symbol + timeframe strip) */
  showHeader?: boolean;
  className?: string;
}

export function ChartPane({ defaultSymbol, showHeader = true, className }: ChartPaneProps) {
  const globalSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  const [localSymbol, setLocalSymbol] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [editingSymbol, setEditingSymbol] = useState(false);
  const [symbolInput, setSymbolInput] = useState('');

  // Pane uses its own symbol if set, otherwise falls back to the global selection
  const activeSymbol = localSymbol ?? defaultSymbol ?? globalSymbol ?? 'AAPL';
  const activeTVInterval = TIMEFRAMES.find((t) => t.tf === timeframe)?.tv ?? 'D';

  function handleSymbolSubmit(e: React.FormEvent) {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (s) {
      setLocalSymbol(s);
      selectSymbol(s); // also update global so other parts of the app know
      setEditingSymbol(false);
      setSymbolInput('');
    }
  }

  return (
    <div className={clsx('flex flex-col min-h-0 bg-bg-primary', className)}>
      {showHeader && (
        <div className="flex items-center gap-1 px-2 h-8 border-b border-panel bg-bg-secondary shrink-0 overflow-x-auto no-scrollbar">
          {/* Symbol button */}
          {editingSymbol ? (
            <form onSubmit={handleSymbolSubmit} className="shrink-0">
              <input
                autoFocus
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                onBlur={() => { setEditingSymbol(false); setSymbolInput(''); }}
                placeholder={activeSymbol}
                className="bg-bg-hover border border-accent/50 rounded px-2 py-0.5 text-xs text-white w-20 focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setEditingSymbol(true)}
              className="flex items-center gap-1 text-xs font-semibold text-white hover:text-accent transition-colors shrink-0 group"
              title="Change symbol"
            >
              {activeSymbol}
              <Search className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          <div className="w-px h-4 bg-border-panel mx-1 shrink-0" />

          {/* Timeframe pills */}
          {TIMEFRAMES.map(({ label, tf }) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={clsx(
                'px-2 py-0.5 rounded text-[11px] transition-colors shrink-0',
                timeframe === tf
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-gray-200 hover:bg-bg-hover'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Chart fills remaining space */}
      <div className="flex-1 min-h-0">
        <TVChartWidget
          symbol={activeSymbol}
          interval={activeTVInterval}
          onSymbolChange={(s) => { setLocalSymbol(s); selectSymbol(s); }}
        />
      </div>
    </div>
  );
}
