/**
 * Mobile full-page watchlist — mirrors TradingView mobile's Watchlist tab.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { useQuotes } from '../hooks/useQuotes';
import type { Quote } from '../types';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function WatchlistPage() {
  const navigate = useNavigate();
  const {
    groups, loadGroups, selectSymbol, allSymbols,
  } = useWatchlistStore();

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const { data: quotesArray = [] } = useQuotes(allSymbols());
  const quotesMap = new Map<string, Quote>(quotesArray.map((q) => [q.symbol, q]));

  function handleSelect(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg-primary">
      <div className="px-3 py-2 border-b border-panel shrink-0 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Watchlist</span>
      </div>

      {groups.map((group) => (
        <div key={group.id}>
          {/* Group header */}
          <div className="px-3 py-1.5 bg-bg-secondary border-b border-panel/50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              {group.name}
            </span>
            <span className="text-[10px] text-text-muted/60 ml-auto">
              {group.symbols.length}
            </span>
          </div>

          {/* Symbols */}
          {group.symbols.map((symbol) => {
            const q = quotesMap.get(symbol);
            const isPos = (q?.changePercent ?? 0) >= 0;
            return (
              <button
                key={symbol}
                onClick={() => handleSelect(symbol)}
                className="w-full flex items-center px-3 py-2.5 border-b border-panel/30 hover:bg-bg-hover active:bg-bg-hover transition-colors"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white">{symbol}</p>
                  {q?.shortName && (
                    <p className="text-[10px] text-text-muted truncate">{q.shortName}</p>
                  )}
                </div>
                {q && (
                  <div className="text-right shrink-0">
                    <p className="text-sm text-white num">${fmt(q.price)}</p>
                    <p className={clsx('text-[11px] font-medium num', isPos ? 'text-green' : 'text-red-400')}>
                      {isPos ? '+' : ''}{fmt(q.changePercent)}%
                    </p>
                  </div>
                )}
              </button>
            );
          })}

          {group.symbols.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-muted/60">
              No symbols in this group
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
