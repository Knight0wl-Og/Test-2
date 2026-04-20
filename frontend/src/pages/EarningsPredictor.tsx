import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchEarningsHistoryFMP, fetchAnalystEstimatesFMP, getFmpKey } from '../services/fmpService';
import clsx from 'clsx';

function fmtEps(v: number | null) {
  if (v == null) return null;
  return (v >= 0 ? '$' : '-$') + Math.abs(v).toFixed(2);
}

export function EarningsPredictor() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(storeSymbol ?? 'AAPL');
  const [symbol, setSymbol] = useState(storeSymbol ?? 'AAPL');
  const hasFmpKey = !!getFmpKey();

  const histQuery = useQuery({
    queryKey: ['earnings-history', symbol],
    queryFn: () => fetchEarningsHistoryFMP(symbol, 8),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const estQuery = useQuery({
    queryKey: ['analyst-estimates', symbol],
    queryFn: () => fetchAnalystEstimatesFMP(symbol, 'quarter'),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const history = histQuery.data ?? [];
  const nextEst = estQuery.data?.[0];

  // Calculate beat rate
  const valid = history.filter((h) => h.eps != null && h.epsEstimated != null);
  const beats = valid.filter((h) => (h.eps ?? 0) > (h.epsEstimated ?? 0));
  const beatRate = valid.length > 0 ? `${beats.length}/${valid.length}` : '—';

  // Chart bar max value
  const allVals = history.flatMap((h) => [Math.abs(h.eps ?? 0), Math.abs(h.epsEstimated ?? 0)]).filter(Boolean);
  const maxVal = allVals.length > 0 ? Math.max(...allVals) : 1;

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-purple shrink-0" />
        <h1 className="text-sm font-bold text-white">Earnings Predictor</h1>
      </div>

      {/* Symbol input */}
      <form
        onSubmit={(e) => { e.preventDefault(); setSymbol(input.trim().toUpperCase()); }}
        className="flex gap-2 mb-4"
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
          Analyse
        </button>
      </form>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">FMP API Key Required</p>
          <p className="text-xs text-text-muted">Add your free FMP key in Settings</p>
        </div>
      )}

      {(histQuery.isLoading || estQuery.isLoading) && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {histQuery.error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {histQuery.error instanceof Error ? histQuery.error.message : 'Failed to load'}
        </div>
      )}

      {/* Summary stats */}
      {history.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Beat Rate</p>
              <p className="text-base font-bold text-green">{beatRate}</p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Next Est.</p>
              <p className="text-base font-bold text-accent">
                {nextEst ? (fmtEps(nextEst.estimatedEpsAvg) ?? '—') : '—'}
              </p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Next Date</p>
              <p className="text-base font-bold text-white">
                {nextEst
                  ? new Date(nextEst.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>

          {/* EPS bar chart */}
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-3">EPS History — 8 Quarters</p>
          <div className="space-y-3">
            {[...history].reverse().map((h, i) => {
              const actual = h.eps;
              const est = h.epsEstimated;
              const beat = actual != null && est != null && actual > est;
              const miss = actual != null && est != null && actual < est;
              const actPct = actual != null ? (Math.abs(actual) / maxVal) * 100 : 0;
              const estPct = est != null ? (Math.abs(est) / maxVal) * 100 : 0;
              const qLabel = new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

              return (
                <div key={i} className="bg-bg-card border border-border-dim rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-mono">{qLabel}</span>
                    <div className="flex items-center gap-2">
                      {actual != null && (
                        <span className={clsx('text-xs font-mono font-semibold', beat ? 'text-green' : miss ? 'text-red-400' : 'text-white')}>
                          {fmtEps(actual)} actual
                        </span>
                      )}
                      {est != null && (
                        <span className="text-[10px] text-text-muted font-mono">est {fmtEps(est)}</span>
                      )}
                    </div>
                  </div>
                  {/* Actual bar */}
                  {actual != null && (
                    <div className="h-2 bg-bg-hover rounded-full overflow-hidden mb-1">
                      <div
                        className={clsx('h-full rounded-full transition-all', beat ? 'bg-green' : miss ? 'bg-red-400' : 'bg-accent')}
                        style={{ width: `${Math.max(actPct, 2)}%` }}
                      />
                    </div>
                  )}
                  {/* Estimate bar */}
                  {est != null && (
                    <div className="h-1 bg-bg-hover rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-text-muted/50"
                        style={{ width: `${Math.max(estPct, 2)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-full bg-green" />
              <span className="text-[10px] text-text-muted">Beat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] text-text-muted">Miss</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded-full bg-text-muted/50" />
              <span className="text-[10px] text-text-muted">Estimate</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
