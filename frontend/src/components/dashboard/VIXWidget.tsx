import clsx from 'clsx';
import { useIndices } from '../../hooks/useMarketData';

function VIXLevel(vix: number): { label: string; color: string } {
  if (vix < 15) return { label: 'Complacency', color: 'text-green' };
  if (vix < 20) return { label: 'Low', color: 'text-green' };
  if (vix < 25) return { label: 'Moderate', color: 'text-gold' };
  if (vix < 30) return { label: 'Elevated', color: 'text-gold' };
  if (vix < 40) return { label: 'High Fear', color: 'text-red' };
  return { label: 'Extreme Fear', color: 'text-red' };
}

export function VIXWidget() {
  const { data: indices, isLoading } = useIndices();
  const vixQuote = indices?.find((q) => q.symbol === '^VIX' || q.symbol === 'VIX');

  if (isLoading) {
    return (
      <div className="bg-bg-card border border-border-dim rounded-lg p-4 space-y-3">
        <div className="skeleton h-3 w-10" />
        <div className="skeleton h-8 w-20" />
        <div className="skeleton h-2.5 w-24" />
      </div>
    );
  }

  if (!vixQuote) {
    return (
      <div className="bg-bg-card border border-border-dim rounded-lg p-4 text-xs text-text-muted">
        VIX data unavailable
      </div>
    );
  }

  const level = VIXLevel(vixQuote.price);
  const isUp = vixQuote.changePercent >= 0;

  // Gauge bar: 0–80 range
  const gaugeWidth = Math.min((vixQuote.price / 80) * 100, 100);
  const gaugeColor =
    vixQuote.price < 20 ? '#22c55e' : vixQuote.price < 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-bg-card border border-border-dim rounded-lg p-4">
      <div className="text-xs text-text-muted uppercase tracking-widest mb-2">VIX</div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold num text-white">{vixQuote.price.toFixed(2)}</span>
        <span className={clsx('text-sm font-medium num mb-0.5', isUp ? 'text-red' : 'text-green')}>
          {isUp ? '+' : ''}{vixQuote.changePercent.toFixed(2)}%
        </span>
      </div>

      <div className={clsx('text-xs font-semibold mt-1', level.color)}>{level.label}</div>

      {/* Gauge bar */}
      <div className="mt-3">
        <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${gaugeWidth}%`, backgroundColor: gaugeColor }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span>0</span>
          <span>20</span>
          <span>40</span>
          <span>80+</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-text-muted">52W High</span>
          <div className="text-gray-200 num font-medium">{vixQuote.fiftyTwoWeekHigh.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-text-muted">52W Low</span>
          <div className="text-gray-200 num font-medium">{vixQuote.fiftyTwoWeekLow.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
