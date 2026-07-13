import { useRef, useState, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SectorHeatmap } from '../components/dashboard/SectorHeatmap';
import { TickerTape } from '../components/dashboard/TickerTape';
import { EconBanner } from '../components/dashboard/EconBanner';
import { YieldCurve } from '../components/dashboard/YieldCurve';
import { ActiveAlertsPanel } from '../components/dashboard/ActiveAlertsPanel';
import { MarketNewsFeed } from '../components/dashboard/MarketNewsFeed';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchBatchQuotes } from '../services/api';
import { fetchEarningsCalendarRange, hasFinnhubKey } from '../services/finnhubService';
import clsx from 'clsx';

const PULL_THRESHOLD = 64;

// ─── Indices row ──────────────────────────────────────────────────────────────

const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA', '^VIX', '^TNX'];
const INDEX_LABELS  = ['S&P 500', 'NASDAQ', 'DOW', 'VIX', '10Y Yield'];

function IndicesRow() {
  const { data: quotes = [] } = useQuery({
    queryKey: ['cmd-indices'],
    queryFn: () => fetchBatchQuotes(INDEX_SYMBOLS),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="grid grid-cols-5 gap-2">
      {INDEX_SYMBOLS.map((sym, i) => {
        const q = quotes.find((q) => q.symbol === sym);
        const up = (q?.changePercent ?? 0) >= 0;
        const isVix = sym === '^VIX';
        return (
          <div key={sym} className="card-surface !rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-1">{INDEX_LABELS[i]}</p>
            <p className="text-base font-bold text-white font-mono leading-tight">
              {q ? (sym === '^TNX' ? `${q.price?.toFixed(2)}%` : q.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '—'}
            </p>
            <div className={clsx('flex items-center gap-1 mt-1', isVix ? (up ? 'text-red-400' : 'text-green-400') : (up ? 'text-green-400' : 'text-red-400'))}>
              <span className="text-[10px] font-mono">{up ? '▲' : '▼'} {Math.abs(q?.changePercent ?? 0).toFixed(2)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Watchlist panel ──────────────────────────────────────────────────────────

function CommandWatchlist() {
  const navigate = useNavigate();
  const { allSymbols, selectSymbol } = useWatchlistStore();
  const symbols = allSymbols().slice(0, 20);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['cmd-watchlist', symbols.join(',')],
    queryFn: () => fetchBatchQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (symbols.length === 0) {
    return <p className="text-xs text-gray-600 text-center py-4">Add symbols to your watchlist</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 mb-1">
        <span className="text-[9px] text-gray-600 uppercase">Ticker</span>
        <span className="text-[9px] text-gray-600 text-right uppercase w-14">Price</span>
        <span className="text-[9px] text-gray-600 text-right uppercase w-12">Chg%</span>
        <span className="text-[9px] text-gray-600 text-right uppercase w-10">Vol</span>
      </div>
      {isLoading
        ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-bg-card/40 rounded animate-pulse mx-1" />
          ))
        : quotes.map((q) => {
            const up = (q.changePercent ?? 0) >= 0;
            const vol = q.volume >= 1e9 ? `${(q.volume / 1e9).toFixed(1)}B`
                      : q.volume >= 1e6 ? `${(q.volume / 1e6).toFixed(0)}M`
                      : `${(q.volume / 1e3).toFixed(0)}K`;
            // 52W range bar
            const range52 = q.fiftyTwoWeekHigh && q.fiftyTwoWeekLow
              ? (q.price - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow)
              : null;

            return (
              <button
                key={q.symbol}
                onClick={() => { selectSymbol(q.symbol); navigate('/'); }}
                className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-2 py-1.5 rounded hover:bg-bg-card/60 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{q.symbol}</p>
                  {range52 != null && (
                    <div className="w-full h-0.5 bg-gray-700 rounded-full mt-0.5">
                      <div
                        className="h-0.5 rounded-full bg-amber-400"
                        style={{ width: `${Math.max(2, Math.min(100, range52 * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono text-gray-300 text-right w-14">
                  ${q.price?.toFixed(2)}
                </span>
                <span className={clsx('text-[10px] font-mono text-right w-12', up ? 'text-green-400' : 'text-red-400')}>
                  {up ? '+' : ''}{(q.changePercent ?? 0).toFixed(2)}%
                </span>
                <span className="text-[9px] text-gray-500 text-right w-10">{vol}</span>
              </button>
            );
          })}
    </div>
  );
}

// ─── Mini earnings panel ──────────────────────────────────────────────────────

function CommandEarnings() {
  const navigate = useNavigate();
  const hasKey = hasFinnhubKey();

  const today = new Date().toISOString().slice(0, 10);
  const friday = new Date(); friday.setDate(friday.getDate() + (5 - friday.getDay() + 7) % 7 || 7);
  const to = friday.toISOString().slice(0, 10);

  const { data = [], isLoading } = useQuery({
    queryKey: ['cmd-earnings', today, to],
    queryFn: () => fetchEarningsCalendarRange(today, to),
    enabled: hasKey,
    staleTime: 30 * 60_000,
  });

  const upcoming = data.slice(0, 8);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
        {!hasKey && (
          <p className="text-[11px] text-gray-600 text-center py-3">Finnhub key required</p>
        )}
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-bg-card/40 rounded animate-pulse" />
        ))}
        {!isLoading && upcoming.length === 0 && hasKey && (
          <p className="text-[11px] text-gray-600 text-center py-3">No earnings this week</p>
        )}
        {upcoming.map((e, i) => (
          <div key={i} className="flex items-center justify-between px-1 py-1.5">
            <div>
              <p className="text-xs font-semibold text-white">{e.symbol}</p>
              <p className="text-[9px] text-gray-500">
                {e.hour === 'bmo' ? 'Pre-mkt' : e.hour === 'amc' ? 'After-cls' : '—'} ·{' '}
                {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              {e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)} est` : 'est TBD'}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate('/earnings')}
        className="text-[10px] text-accent hover:text-white transition-colors mt-1 text-center"
      >
        Full calendar →
      </button>
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ title, badge, children, className }: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('card-surface flex flex-col p-3', className)}>
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <span className="section-label !mb-0">{title}</span>
        {badge && (
          <span className="text-[8px] bg-green-400/20 text-green-400 px-1 py-0.5 rounded font-bold">{badge}</span>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const queryClient = useQueryClient();
  const touchStartY = useRef(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop > 0) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.5, PULL_THRESHOLD + 20));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullY >= PULL_THRESHOLD) {
      setRefreshing(true);
      await queryClient.invalidateQueries();
      setRefreshing(false);
    }
    setPullY(0);
  }, [pullY, queryClient]);

  return (
    <div
      className="flex flex-col min-h-full bg-bg-primary relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh */}
      {(pullY > 8 || refreshing) && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"
          style={{ height: `${Math.max(pullY, refreshing ? 40 : 0)}px` }}>
          <RefreshCw className={clsx('w-5 h-5 text-accent', refreshing && 'animate-spin')}
            style={{ transform: `rotate(${(pullY / PULL_THRESHOLD) * 180}deg)` }} />
        </div>
      )}

      {/* Ticker tape */}
      <TickerTape />

      {/* Econ banner */}
      <EconBanner />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Indices row */}
        <IndicesRow />

        {/* 4-panel grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Watchlist" badge="LIVE" className="h-64 lg:h-72">
            <CommandWatchlist />
          </Panel>

          <Panel title="Sector Heat Map" badge="LIVE" className="h-64 lg:h-72">
            <div className="flex-1 min-h-0">
              <SectorHeatmap compact />
            </div>
          </Panel>

          <Panel title="Yield Curve" className="h-56 lg:h-64">
            <YieldCurve />
          </Panel>

          <Panel title="Earnings" className="h-56 lg:h-64">
            <CommandEarnings />
          </Panel>
        </div>

        {/* Alerts + News row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel title="Active Alerts" className="h-48">
            <ActiveAlertsPanel />
          </Panel>

          <Panel title="Market News" badge="LIVE" className="h-48">
            <MarketNewsFeed />
          </Panel>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-gray-700 text-center pb-2">
          TradeEdge is for informational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
