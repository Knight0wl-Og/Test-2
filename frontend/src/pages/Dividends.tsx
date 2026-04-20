import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchDividendHistoryFMP, getFmpKey } from '../services/fmpService';
import clsx from 'clsx';

function fmtDate(str: string): string {
  if (!str) return '—';
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Dividends() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(storeSymbol ?? 'AAPL');
  const [symbol, setSymbol] = useState(storeSymbol ?? 'AAPL');
  const hasFmpKey = !!getFmpKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dividend-history', symbol],
    queryFn: () => fetchDividendHistoryFMP(symbol),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const history = data ?? [];

  // Calculate stats
  const lastYear = history.filter((d) => {
    const y = new Date(d.date + 'T12:00:00').getFullYear();
    return y === new Date().getFullYear() - 1 || y === new Date().getFullYear();
  });
  const annualTotal = lastYear.reduce((s, d) => s + (d.dividend ?? 0), 0);
  const latest = history[0];

  // 5-year CAGR from annual totals
  const byYear: Record<number, number> = {};
  history.forEach((d) => {
    const y = new Date(d.date + 'T12:00:00').getFullYear();
    byYear[y] = (byYear[y] ?? 0) + (d.dividend ?? 0);
  });
  const years = Object.keys(byYear).map(Number).sort();
  const cagr = years.length >= 2
    ? (((byYear[years[years.length - 1]] / byYear[years[0]]) ** (1 / (years.length - 1))) - 1) * 100
    : null;

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-green shrink-0" />
        <h1 className="text-sm font-bold text-white">Dividends</h1>
      </div>

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
        <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          Load
        </button>
      </form>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">FMP API Key Required</p>
          <p className="text-xs text-text-muted">Add your free FMP key in Settings</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      )}

      {history.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Latest Div.</p>
              <p className="text-base font-bold text-green">
                ${(latest?.dividend ?? 0).toFixed(4)}
              </p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Annual Est.</p>
              <p className="text-base font-bold text-accent">
                ${annualTotal.toFixed(2)}
              </p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">CAGR</p>
              <p className={clsx(
                'text-base font-bold',
                cagr == null ? 'text-text-muted' : cagr >= 0 ? 'text-green' : 'text-red-400'
              )}>
                {cagr != null ? `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>

          {/* History table */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 px-2 mb-1">
            <span className="text-[10px] text-text-muted">#</span>
            <span className="text-[10px] text-text-muted">Ex-Date</span>
            <span className="text-[10px] text-text-muted text-right">Payment</span>
            <span className="text-[10px] text-text-muted text-right">Amount</span>
          </div>

          <div className="space-y-1">
            {history.slice(0, 24).map((d, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center bg-bg-card border border-border-dim rounded-lg px-3 py-2"
              >
                <span className="text-[10px] text-text-muted/50 w-5 font-mono">{i + 1}</span>
                <span className="text-xs text-gray-300 font-mono">{fmtDate(d.date)}</span>
                <span className="text-xs text-text-muted font-mono text-right">{fmtDate(d.paymentDate)}</span>
                <span className="text-xs text-green font-mono text-right">${(d.dividend ?? 0).toFixed(4)}</span>
              </div>
            ))}
          </div>

          {history.length > 24 && (
            <p className="text-[10px] text-text-muted/50 text-center mt-3">
              Showing 24 of {history.length} records
            </p>
          )}
        </>
      )}

      {!isLoading && history.length === 0 && hasFmpKey && !error && (
        <p className="text-center text-text-muted text-sm py-8">No dividend history found for {symbol}</p>
      )}
    </div>
  );
}
