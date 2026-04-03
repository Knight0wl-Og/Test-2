import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';
import { fetchBatchQuotes } from '../services/api';
import { useWatchlistStore } from '../store/watchlistStore';
import type { Quote } from '../types';

const TICKER_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','ORCL',
  'CRM','ADBE','INTC','NFLX','PYPL','SQ','COIN','PLTR','ARM','SNOW',
  'GS','JPM','BAC','WFC','V','MA','AXP','BLK','C','MS',
  'UNH','JNJ','PFE','ABBV','MRK','LLY','CVS','AMGN',
  'CVX','XOM','COP','SLB','OXY',
  'NEE','DUK','SO',
  'BA','CAT','GE','HON','UPS','FDX','LMT','RTX',
  'COST','WMT','TGT','HD','LOW','NKE','MCD','SBUX','DIS','CMCSA',
];

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

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['topMovers'],
    queryFn: () => fetchBatchQuotes(TICKER_UNIVERSE),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  function handleSelect(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.filter((q) => q.changePercent > 0).slice(0, 10);
  const losers = [...sorted].reverse().filter((q) => q.changePercent < 0).slice(0, 10);

  return (
    <div className="p-4 space-y-6 min-h-full">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-accent" />
        <h1 className="text-base font-bold text-white">Top Movers</h1>
        <span className="text-xs text-text-muted">· refreshes every 60s</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-dim">
            <TrendingUp className="w-4 h-4 text-green" />
            <span className="text-xs font-semibold text-green uppercase tracking-widest">Top Gainers</span>
          </div>
          {isLoading ? (
            <SkeletonRows count={10} />
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
          {isLoading ? (
            <SkeletonRows count={10} />
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
