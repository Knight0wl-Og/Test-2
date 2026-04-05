import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, ExternalLink, Users } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { fetchResearch } from '../services/api';
import { useWatchlistStore } from '../store/watchlistStore';
import type { ResearchData } from '../services/nativeResearch';

function fmt(n: number | null, d = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

function fmtLarge(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString();
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border-dim/40 last:border-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs text-gray-200 font-medium num">{value}</span>
    </div>
  );
}

function AnalystBar({ buy, hold, sell }: { buy: number; hold: number; sell: number }) {
  const total = buy + hold + sell;
  if (total === 0) return <p className="text-xs text-text-muted">No analyst data available.</p>;
  const buyPct = (buy / total) * 100;
  const holdPct = (hold / total) * 100;
  const sellPct = (sell / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex rounded overflow-hidden h-3">
        <div className="bg-green transition-all" style={{ width: `${buyPct}%` }} title={`Buy: ${buy}`} />
        <div className="bg-yellow-500 transition-all" style={{ width: `${holdPct}%` }} title={`Hold: ${hold}`} />
        <div className="bg-red-500 transition-all" style={{ width: `${sellPct}%` }} title={`Sell: ${sell}`} />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span className="text-green">{buy} Buy</span>
        <span className="text-yellow-400">{hold} Hold</span>
        <span className="text-red-400">{sell} Sell</span>
      </div>
    </div>
  );
}

export function Research() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(selectedSymbol ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol ?? '');
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<ResearchData>({
    queryKey: ['research', symbol],
    queryFn: () => fetchResearch(symbol),
    enabled: !!symbol,
    staleTime: 300_000,
    retry: 1,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const s = input.trim().toUpperCase();
    if (s) setSymbol(s);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-accent" />
        <h1 className="text-sm font-semibold text-white">Research</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Enter ticker…"
            className="w-full bg-bg-card border border-border-dim rounded pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          className="bg-accent hover:bg-accent-hover text-white rounded px-4 py-1.5 text-sm font-medium transition-colors"
        >
          Look up
        </button>
      </form>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[200, 120, 80].map((w) => (
            <div key={w} className="h-4 bg-bg-card rounded animate-pulse" style={{ width: `${w}px` }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-bg-card border border-red-900/40 rounded-lg p-4 text-sm text-red-400">
          Could not load research data for {symbol}. The symbol may be invalid or data unavailable.
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-bg-card border border-border-dim rounded-lg p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <button
                  onClick={() => { useWatchlistStore.getState().selectSymbol(data.symbol); navigate('/'); }}
                  className="text-lg font-bold text-white hover:text-accent transition-colors"
                >
                  {data.symbol}
                </button>
                <p className="text-sm text-text-muted">{data.shortName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs px-2 py-0.5 rounded bg-bg-hover text-text-muted">{data.sector}</span>
                {data.website && (
                  <a
                    href={data.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-accent hover:underline mt-1 justify-end"
                  >
                    Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            {data.industry && (
              <p className="text-xs text-text-muted">{data.industry}</p>
            )}
            {data.employees && (
              <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
                <Users className="w-3 h-3" />
                {data.employees.toLocaleString()} employees
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Key Stats */}
            <div className="bg-bg-card border border-border-dim rounded-lg p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Key Stats</p>
              <StatRow label="Trailing P/E" value={fmt(data.trailingPE)} />
              <StatRow label="Forward P/E" value={fmt(data.forwardPE)} />
              <StatRow label="EPS (TTM)" value={data.eps != null ? `$${fmt(data.eps)}` : '—'} />
              <StatRow label="Revenue" value={fmtLarge(data.totalRevenue)} />
              <StatRow label="Revenue / Share" value={data.revenuePerShare != null ? `$${fmt(data.revenuePerShare)}` : '—'} />
              <StatRow label="Profit Margin" value={fmtPct(data.profitMargins)} />
              <StatRow label="Revenue Growth" value={fmtPct(data.revenueGrowth)} />
              <StatRow label="Return on Equity" value={fmtPct(data.returnOnEquity)} />
              <StatRow label="Debt / Equity" value={fmt(data.debtToEquity)} />
              <StatRow label="Current Ratio" value={fmt(data.currentRatio)} />
            </div>

            {/* Analyst Consensus */}
            <div className="bg-bg-card border border-border-dim rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Analyst Consensus</p>
              <AnalystBar
                buy={data.recommendationBuy}
                hold={data.recommendationHold}
                sell={data.recommendationSell}
              />
              {data.recommendationMean != null && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-bg-hover rounded p-3 text-center">
                    <p className="text-xs text-text-muted mb-1">Consensus Score</p>
                    <p className={clsx('text-base font-bold num', data.recommendationMean <= 2 ? 'text-green' : data.recommendationMean <= 3 ? 'text-yellow-400' : 'text-red-400')}>
                      {fmt(data.recommendationMean, 1)}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">1=Strong Buy · 5=Sell</p>
                  </div>
                  <div className="bg-bg-hover rounded p-3 text-center">
                    <p className="text-xs text-text-muted mb-1">Price Target</p>
                    <p className="text-base font-bold text-white num">
                      {data.targetMeanPrice != null ? `$${fmt(data.targetMeanPrice)}` : '—'}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">{data.numberOfAnalystOpinions ?? 0} analysts</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Business Summary */}
          {data.longBusinessSummary && (
            <div className="bg-bg-card border border-border-dim rounded-lg p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">About</p>
              <p className="text-xs text-gray-300 leading-relaxed">{data.longBusinessSummary}</p>
            </div>
          )}
        </div>
      )}

      {!symbol && !isLoading && (
        <div className="bg-bg-card border border-border-dim rounded-lg p-8 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-text-muted/40 mx-auto" />
          <p className="text-sm text-text-muted">Enter a ticker symbol to view research data</p>
        </div>
      )}
    </div>
  );
}
