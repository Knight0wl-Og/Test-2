import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { fetchEtfHoldersFMP, getFmpKey } from '../services/fmpService';
import clsx from 'clsx';

const POPULAR_ETFS = ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'ARKK', 'XLK', 'XLF'];

function fmtLarge(n: number): string {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export function EtfFlows() {
  const [input, setInput] = useState('SPY');
  const [symbol, setSymbol] = useState('SPY');
  const hasFmpKey = !!getFmpKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['etf-holders', symbol],
    queryFn: () => fetchEtfHoldersFMP(symbol),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const holders = data ?? [];
  const totalWeight = holders.reduce((s, h) => s + (h.weightPercentage ?? 0), 0);

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">ETF Flows</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setSymbol(input.trim().toUpperCase()); }}
        className="flex gap-2 mb-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ETF Symbol"
          className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          Load
        </button>
      </form>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {POPULAR_ETFS.map((sym) => (
          <button
            key={sym}
            onClick={() => { setInput(sym); setSymbol(sym); }}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors',
              symbol === sym
                ? 'bg-accent/20 border-accent/50 text-accent'
                : 'bg-bg-card border-border-dim text-text-muted hover:text-white'
            )}
          >
            {sym}
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
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Failed to load'}
        </div>
      )}

      {holders.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">
              {symbol} Top Holdings ({holders.length})
            </p>
            {holders[0]?.updated && (
              <p className="text-[10px] text-text-muted/50">
                As of {new Date(holders[0].updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-2 mb-1">
            <span className="text-[10px] text-text-muted w-6">#</span>
            <span className="text-[10px] text-text-muted">Holding</span>
            <span className="text-[10px] text-text-muted text-right">Mkt Value</span>
            <span className="text-[10px] text-text-muted text-right">Weight</span>
          </div>

          <div className="space-y-1">
            {holders.slice(0, 25).map((h, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center bg-bg-card border border-border-dim rounded-lg px-3 py-2"
              >
                <span className="text-[10px] text-text-muted/50 font-mono w-6">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate font-mono">{h.asset}</p>
                  <p className="text-[10px] text-text-muted truncate">{h.name}</p>
                </div>
                <span className="text-xs font-mono text-gray-400 text-right">
                  {h.marketValue ? fmtLarge(h.marketValue) : '—'}
                </span>
                <div className="text-right w-14">
                  <p className="text-xs font-mono text-accent font-semibold">
                    {h.weightPercentage != null ? h.weightPercentage.toFixed(2) + '%' : '—'}
                  </p>
                  <div className="h-0.5 bg-bg-hover rounded-full mt-1">
                    <div
                      className="h-full bg-accent/60 rounded-full"
                      style={{ width: `${Math.min((h.weightPercentage ?? 0) / (totalWeight || 100) * 100 * 3, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {holders.length > 25 && (
            <p className="text-[10px] text-text-muted/50 text-center mt-3">
              Showing 25 of {holders.length} holdings
            </p>
          )}
        </>
      )}
    </div>
  );
}
