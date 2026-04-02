import { useIndices } from '../../hooks/useMarketData';
import { useWatchlistStore } from '../../store/watchlistStore';
import { IndexCard, IndexCardSkeleton } from './IndexCard';

const DISPLAY_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', '^GSPC', '^IXIC', '^VIX'];

export function MarketOverview() {
  const { data: indices, isLoading } = useIndices();
  const { selectedSymbol, selectSymbol } = useWatchlistStore();

  const display = indices
    ? DISPLAY_SYMBOLS.map((sym) => indices.find((q) => q.symbol === sym || q.symbol === sym.replace('^', ''))).filter(Boolean)
    : [];

  return (
    <section>
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
        Market Overview
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-7 lg:overflow-x-visible">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => <IndexCardSkeleton key={i} />)
          : display.map((q) =>
              q ? (
                <IndexCard
                  key={q.symbol}
                  quote={q}
                  selected={selectedSymbol === q.symbol}
                  onClick={() => selectSymbol(q.symbol)}
                />
              ) : null
            )}
      </div>
    </section>
  );
}
