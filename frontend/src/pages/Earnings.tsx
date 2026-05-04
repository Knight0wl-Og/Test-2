import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchEarningsCalendarRange, hasFinnhubKey } from '../services/finnhubService';
import clsx from 'clsx';

function getWeekBounds(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const lbl = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' + friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { from: fmt(monday), to: fmt(friday), label: lbl };
}

function fmtSurprise(pct: number | null) {
  if (pct == null) return null;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

export function Earnings() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to, label } = getWeekBounds(weekOffset);
  const hasKey = hasFinnhubKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['earnings-calendar-fh', from, to],
    queryFn: () => fetchEarningsCalendarRange(from, to),
    enabled: hasKey,
    staleTime: 30 * 60 * 1000,
  });

  function handleRow(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-accent shrink-0" />
        <h1 className="text-sm font-bold text-white">Earnings Calendar</h1>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 bg-bg-card border border-border-dim rounded-lg px-3 py-2">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="text-text-muted hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-gray-300">{label}</span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="text-text-muted hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {!hasKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">Finnhub API Key Required</p>
          <p className="text-xs text-text-muted">
            Add your free Finnhub key in Settings — get one at finnhub.io
          </p>
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
          {error instanceof Error ? error.message : 'Failed to load earnings'}
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-center text-text-muted text-sm py-8">No earnings scheduled this week</p>
      )}

      {data && data.length > 0 && (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 mb-1">
            <span className="text-[10px] text-text-muted">Symbol</span>
            <span className="text-[10px] text-text-muted text-right">Date</span>
            <span className="text-[10px] text-text-muted text-right">EPS Est</span>
            <span className="text-[10px] text-text-muted text-right">Surprise</span>
          </div>

          <div className="space-y-1">
            {data.map((e, i) => {
              const surprise = fmtSurprise(
                e.epsActual != null && e.epsEstimate != null && e.epsEstimate !== 0
                  ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100
                  : null
              );
              const beat = e.epsActual != null && e.epsEstimate != null && e.epsActual > e.epsEstimate;
              const miss = e.epsActual != null && e.epsEstimate != null && e.epsActual < e.epsEstimate;
              const pending = e.epsActual == null;

              return (
                <button
                  key={i}
                  onClick={() => handleRow(e.symbol)}
                  className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-bg-card hover:bg-bg-hover border border-border-dim rounded-lg px-3 py-2.5 transition-colors text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{e.symbol}</p>
                    <p className="text-[10px] text-text-muted">
                      {e.hour === 'bmo' ? 'Pre-market' : e.hour === 'amc' ? 'After-close' : '—'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs text-gray-300 font-mono text-right">
                    {e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : '—'}
                  </span>
                  <span className={clsx(
                    'text-xs font-mono text-right w-14',
                    pending ? 'text-text-muted' : beat ? 'text-green' : miss ? 'text-red-400' : 'text-text-muted'
                  )}>
                    {pending ? 'Pending' : surprise ?? '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-text-muted/50 text-center mt-4">
            {data.length} companies · tap a row to view chart
          </p>
        </>
      )}
    </div>
  );
}
