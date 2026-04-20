import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchKeyMetricsFMP, fetchAnalystEstimatesFMP, getFmpKey } from '../services/fmpService';

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-dim/30 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-xs font-mono font-semibold ${color ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

function fmt(v: number | null, decimals = 2, suffix = '') {
  if (v == null || isNaN(v)) return '—';
  return v.toFixed(decimals) + suffix;
}
function fmtPct(v: number | null) { return fmt(v != null ? v * 100 : null, 2, '%'); }
function fmtLarge(v: number | null) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(2)}`;
}

export function EpsValuation() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(storeSymbol ?? 'AAPL');
  const [symbol, setSymbol] = useState(storeSymbol ?? 'AAPL');
  const hasFmpKey = !!getFmpKey();

  const metricsQuery = useQuery({
    queryKey: ['key-metrics', symbol],
    queryFn: () => fetchKeyMetricsFMP(symbol),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const estQuery = useQuery({
    queryKey: ['analyst-estimates', symbol],
    queryFn: () => fetchAnalystEstimatesFMP(symbol, 'quarter'),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const m = metricsQuery.data?.[0];
  const nextEst = estQuery.data?.[0];

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <BarChart className="w-4 h-4 text-indigo-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">EPS & Valuation</h1>
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
          Look up
        </button>
      </form>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">FMP API Key Required</p>
          <p className="text-xs text-text-muted">Add your free FMP key in Settings</p>
        </div>
      )}

      {(metricsQuery.isLoading || estQuery.isLoading) && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {metricsQuery.error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load'}
        </div>
      )}

      {m && (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Market Cap</p>
              <p className="text-base font-bold text-accent">{fmtLarge(m.marketCap)}</p>
            </div>
            <div className="bg-bg-card border border-border-dim rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-muted mb-1">Next EPS Est.</p>
              <p className="text-base font-bold text-green">
                {nextEst ? `$${nextEst.estimatedEpsAvg.toFixed(2)}` : '—'}
              </p>
              <p className="text-[9px] text-text-muted mt-0.5">
                {nextEst ? new Date(nextEst.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''}
              </p>
            </div>
          </div>

          {/* Valuation metrics */}
          <div className="bg-bg-card border border-border-dim rounded-lg px-4 py-1 mb-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider py-2 border-b border-border-dim/30">Valuation</p>
            <Row label="P/E Ratio (TTM)" value={fmt(m.pe, 2, 'x')} />
            <Row label="P/B Ratio" value={fmt(m.pbRatio, 2, 'x')} />
            <Row label="P/S Ratio" value={fmt(m.priceToSalesRatio, 2, 'x')} />
            <Row label="EV/EBITDA" value={fmt(m.enterpriseValueOverEBITDA, 2, 'x')} />
            <Row label="Dividend Yield" value={fmtPct(m.dividendYield)} color={m.dividendYield != null && m.dividendYield > 0 ? 'text-green' : undefined} />
          </div>

          {/* Per-share metrics */}
          <div className="bg-bg-card border border-border-dim rounded-lg px-4 py-1 mb-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider py-2 border-b border-border-dim/30">Per Share</p>
            <Row label="EPS (TTM)" value={m.pe != null ? '—' : '—'} />
            <Row label="Revenue / Share" value={`$${fmt(m.marketCap && m.priceToSalesRatio ? (m.marketCap / m.priceToSalesRatio) / 1e9 : null, 2)}B`} />
            <Row label="Enterprise Value" value={fmtLarge(m.enterpriseValue ?? null)} />
          </div>

          {/* Profitability */}
          <div className="bg-bg-card border border-border-dim rounded-lg px-4 py-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wider py-2 border-b border-border-dim/30">Profitability</p>
            <Row label="Return on Equity" value={fmtPct(m.roe)} color={m.roe != null && m.roe > 0.1 ? 'text-green' : undefined} />
            <Row label="Earnings Yield" value={fmtPct(m.earningsYield ?? null)} />
            <Row label="FCF Yield" value={fmtPct(m.freeCashFlowYield ?? null)} />
          </div>

          <p className="text-[10px] text-text-muted/40 text-center mt-4">Data as of {m.date}</p>
        </>
      )}
    </div>
  );
}
