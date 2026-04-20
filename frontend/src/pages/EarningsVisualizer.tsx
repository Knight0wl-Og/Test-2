import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchIncomeStatementFMP, getFmpKey } from '../services/fmpService';
import clsx from 'clsx';

type Period = 'quarter' | 'annual';

function fmtLarge(n: number): string {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function MiniChart({
  data,
  color,
  label,
}: {
  data: { label: string; value: number }[];
  color: string;
  label: string;
}) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const normalize = (v: number) => ((v - min) / range) * 100;

  return (
    <div className="bg-bg-card border border-border-dim rounded-lg p-3 mb-3">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end gap-1 h-16">
        {data.map((d, i) => {
          const pct = normalize(d.value);
          const isNeg = d.value < 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
              <div
                className={clsx('rounded-sm w-full transition-all', isNeg ? 'bg-red-400/70' : color)}
                style={{ height: `${Math.max(pct, 3)}%` }}
                title={`${d.label}: ${fmtLarge(d.value)}`}
              />
            </div>
          );
        })}
      </div>
      {/* X labels — show every other one to avoid crowding */}
      <div className="flex gap-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 2 === 0 && <span className="text-[8px] text-text-muted/60 font-mono">{d.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EarningsVisualizer() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(storeSymbol ?? 'AAPL');
  const [symbol, setSymbol] = useState(storeSymbol ?? 'AAPL');
  const [period, setPeriod] = useState<Period>('quarter');
  const hasFmpKey = !!getFmpKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['income-statement', symbol, period],
    queryFn: () => fetchIncomeStatementFMP(symbol, period, period === 'quarter' ? 12 : 5),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const statements = [...(data ?? [])].reverse(); // oldest first

  // Format label from date
  const lbl = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    return period === 'quarter'
      ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      : d.getFullYear().toString();
  };

  const revenueData = statements.map((s) => ({ label: lbl(s.date), value: s.revenue }));
  const netIncomeData = statements.map((s) => ({ label: lbl(s.date), value: s.netIncome }));
  const epsData = statements.map((s) => ({ label: lbl(s.date), value: s.epsDiluted }));

  // YoY growth
  const latest = statements[statements.length - 1];
  const yearAgo = statements[statements.length - 5]; // ~4 quarters back
  const revGrowth = latest && yearAgo && yearAgo.revenue
    ? ((latest.revenue - yearAgo.revenue) / Math.abs(yearAgo.revenue)) * 100
    : null;
  const epsGrowth = latest && yearAgo && yearAgo.epsDiluted
    ? ((latest.epsDiluted - yearAgo.epsDiluted) / Math.abs(yearAgo.epsDiluted)) * 100
    : null;

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-4 h-4 text-cyan-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Earnings Visualizer</h1>
      </div>

      {/* Controls */}
      <form
        onSubmit={(e) => { e.preventDefault(); setSymbol(input.trim().toUpperCase()); }}
        className="flex gap-2 mb-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="Symbol"
          className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          Load
        </button>
      </form>

      {/* Period toggle */}
      <div className="flex gap-1 mb-4">
        {(['quarter', 'annual'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
              period === p ? 'bg-accent text-white' : 'bg-bg-card text-text-muted hover:text-white border border-border-dim'
            )}
          >
            {p === 'quarter' ? 'Quarterly' : 'Annual'}
          </button>
        ))}
      </div>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">FMP API Key Required</p>
          <p className="text-xs text-text-muted">Add your free FMP key in Settings</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      )}

      {statements.length > 0 && (
        <>
          {/* Key stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Revenue Growth</p>
              <p className={clsx(
                'text-base font-bold',
                revGrowth == null ? 'text-text-muted' : revGrowth >= 0 ? 'text-green' : 'text-red-400'
              )}>
                {revGrowth != null ? `${revGrowth >= 0 ? '+' : ''}${revGrowth.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-text-muted mt-0.5">YoY</p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">EPS Growth</p>
              <p className={clsx(
                'text-base font-bold',
                epsGrowth == null ? 'text-text-muted' : epsGrowth >= 0 ? 'text-green' : 'text-red-400'
              )}>
                {epsGrowth != null ? `${epsGrowth >= 0 ? '+' : ''}${epsGrowth.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-text-muted mt-0.5">YoY</p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Net Margin</p>
              <p className={clsx(
                'text-base font-bold',
                latest == null ? 'text-text-muted' : latest.netIncomeRatio >= 0 ? 'text-accent' : 'text-red-400'
              )}>
                {latest ? `${(latest.netIncomeRatio * 100).toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-text-muted mt-0.5">Latest</p>
            </div>
          </div>

          <MiniChart data={revenueData} color="bg-accent/70" label="Revenue" />
          <MiniChart data={netIncomeData} color="bg-green/70" label="Net Income" />
          <MiniChart data={epsData} color="bg-purple/70" label="EPS (Diluted)" />
        </>
      )}
    </div>
  );
}
