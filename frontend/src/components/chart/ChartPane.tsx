import { useState } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useQuote } from '../../hooks/useQuotes';
import { ProChart } from './ProChart';
import { OptionsPanel } from './OptionsPanel';

interface ChartPaneProps {
  defaultSymbol?: string;
  showHeader?: boolean;
  showOptions?: boolean;
  className?: string;
}

export function ChartPane({ defaultSymbol, showHeader = true, showOptions = true, className }: ChartPaneProps) {
  const globalSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  const [localSymbol, setLocalSymbol] = useState<string | null>(null);
  const [editingSymbol, setEditingSymbol] = useState(false);
  const [symbolInput, setSymbolInput] = useState('');

  const activeSymbol = localSymbol ?? defaultSymbol ?? globalSymbol ?? 'AAPL';
  const { data: quote } = useQuote(activeSymbol);

  function handleSymbolSubmit(e: React.FormEvent) {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (s) {
      setLocalSymbol(s);
      selectSymbol(s);
      setEditingSymbol(false);
      setSymbolInput('');
    }
  }

  return (
    <div className={clsx('flex flex-col min-h-0 bg-bg-primary', className)}>
      {showHeader && (
        <div className="flex items-center gap-1 px-2 h-7 border-b border-panel bg-bg-secondary shrink-0 overflow-x-auto no-scrollbar">
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
              className="flex items-center gap-1 text-[11px] font-semibold text-white hover:text-accent transition-colors shrink-0 group"
            >
              {activeSymbol}
              {quote && (
                <span className="text-[10px] font-mono text-text-muted group-hover:text-accent/70">
                  · {quote.price.toFixed(2)}
                </span>
              )}
              <Search className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      )}

      {/* Chart fills remaining space */}
      <ProChart symbol={activeSymbol} className="flex-1 min-h-0" />

      {/* Options chain panel */}
      {showOptions && (
        <OptionsPanel symbol={activeSymbol} underlyingPrice={quote?.price} />
      )}
    </div>
  );
}
