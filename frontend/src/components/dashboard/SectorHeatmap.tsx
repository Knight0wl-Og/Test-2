import clsx from 'clsx';
import { useSectors } from '../../hooks/useMarketData';
import { useWatchlistStore } from '../../store/watchlistStore';

function heatColor(pct: number): string {
  const abs = Math.min(Math.abs(pct), 3);
  const intensity = abs / 3;
  if (pct > 0) {
    const g = Math.round(80 + intensity * 100);
    return `rgba(34, ${g + 50}, 94, ${0.15 + intensity * 0.55})`;
  } else {
    const r = Math.round(180 + intensity * 55);
    return `rgba(${r}, 50, 50, ${0.15 + intensity * 0.55})`;
  }
}

function SectorCell({
  symbol,
  name,
  changePercent,
  price,
  selected,
  onClick,
}: {
  symbol: string;
  name: string;
  changePercent: number;
  price: number;
  selected: boolean;
  onClick: () => void;
}) {
  const isPos = changePercent >= 0;
  return (
    <button
      onClick={onClick}
      style={{ backgroundColor: heatColor(changePercent) }}
      className={clsx(
        'border rounded p-2 text-left transition-all hover:brightness-125 min-h-[70px] flex flex-col justify-between',
        selected ? 'border-accent' : 'border-border-dim'
      )}
    >
      <div>
        <div className="text-xs font-bold text-gray-100">{symbol}</div>
        <div className="text-xs text-text-muted leading-tight mt-0.5">{name}</div>
      </div>
      <div className={clsx('text-sm font-semibold num', isPos ? 'text-green' : 'text-red')}>
        {isPos ? '+' : ''}{changePercent.toFixed(2)}%
      </div>
    </button>
  );
}

function SkeletonCell() {
  return (
    <div className="bg-bg-card border border-border-dim rounded p-2 min-h-[70px] space-y-2">
      <div className="skeleton h-3 w-10" />
      <div className="skeleton h-2.5 w-16" />
      <div className="skeleton h-3 w-12" />
    </div>
  );
}

export function SectorHeatmap({ compact }: { compact?: boolean } = {}) {
  const { data: sectors, isLoading } = useSectors();
  const { selectedSymbol, selectSymbol } = useWatchlistStore();

  return (
    <section>
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
        Sector Heatmap
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-1.5">
        {isLoading
          ? Array.from({ length: 11 }).map((_, i) => <SkeletonCell key={i} />)
          : sectors?.map((s) => (
              <SectorCell
                key={s.symbol}
                symbol={s.symbol}
                name={s.name}
                changePercent={s.changePercent ?? 0}
                price={s.price ?? 0}
                selected={selectedSymbol === s.symbol}
                onClick={() => selectSymbol(s.symbol)}
              />
            ))}
      </div>
    </section>
  );
}
