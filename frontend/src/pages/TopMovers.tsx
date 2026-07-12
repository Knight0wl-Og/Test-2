import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';
import { fetchScreener } from '../services/api';
import { ErrorState } from '../components/common/ErrorState';
import { useWatchlistStore } from '../store/watchlistStore';
import type { Quote } from '../types';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function MoverRow({ rank, quote, onSelect }: { rank: number; quote: Quote; onSelect: () => void }) {
  const isPos = quote.changePercent >= 0;
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
    >
      <span className="w-6 text-xs text-text-muted text-right shrink-0 font-mono">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-white">{quote.symbol}</span>
          <span className="text-xs text-text-muted truncate hidden sm:inline">{quote.shortName}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-white num">{fmt(quote.price)}</div>
        <div className={clsx('text-xs font-medium num', isPos ? 'text-green' : 'text-red')}>
          {isPos ? '+' : ''}{fmt(quote.changePercent)}%
        </div>
      </div>
    </button>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton w-6 h-3 rounded" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-16 rounded" />
          </div>
          <div className="space-y-1.5 text-right">
            <div className="skeleton h-3 w-14 rounded ml-auto" />
            <div className="skeleton h-3 w-10 rounded ml-auto" />
          </div>
        </div>
      ))}
    </>
  );
}

export function TopMovers() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  // Real market-wide movers from Yahoo's predefined screeners
  const gainersQ = useQuery<Quote[]>({
    queryKey: ['screener', 'day_gainers', 10],
    queryFn: () => fetchScreener('day_gainers', 10),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const losersQ = useQuery<Quote[]>({
    queryKey: ['screener', 'day_losers', 10],
    queryFn: () => fetchScreener('day_losers', 10),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  function handleSelect(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  const gainers = gainersQ.data ?? [];
  const losers = losersQ.data ?? [];

  return (
    <div className="p-4 space-y-6 min-h-full">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-accent" />
        <h1 className="text-base font-bold text-white">Top Movers</h1>
        <span className="text-xs text-text-muted">· market-wide · refreshes every 60s</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-dim">
            <TrendingUp className="w-4 h-4 text-green" />
            <span className="text-xs font-semibold text-green uppercase tracking-widest">Top Gainers</span>
          </div>
          {gainersQ.isLoading ? (
            <SkeletonRows count={10} />
          ) : gainersQ.error ? (
            <div className="p-4">
              <ErrorState
                title="Failed to load gainers"
                message={gainersQ.error instanceof Error ? gainersQ.error.message : undefined}
                onRetry={() => gainersQ.refetch()}
              />
            </div>
          ) : gainers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">No gainers yet</p>
          ) : (
            gainers.map((q, i) => (
              <MoverRow key={q.symbol} rank={i + 1} quote={q} onSelect={() => handleSelect(q.symbol)} />
            ))
          )}
        </div>

        {/* Top Losers */}
        <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-dim">
            <TrendingDown className="w-4 h-4 text-red" />
            <span className="text-xs font-semibold text-red uppercase tracking-widest">Top Losers</span>
          </div>
          {losersQ.isLoading ? (
            <SkeletonRows count={10} />
          ) : losersQ.error ? (
            <div className="p-4">
              <ErrorState
                title="Failed to load losers"
                message={losersQ.error instanceof Error ? losersQ.error.message : undefined}
                onRetry={() => losersQ.refetch()}
              />
            </div>
          ) : losers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">No losers yet</p>
          ) : (
            losers.map((q, i) => (
              <MoverRow key={q.symbol} rank={i + 1} quote={q} onSelect={() => handleSelect(q.symbol)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
