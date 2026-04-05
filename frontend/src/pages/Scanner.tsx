import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { fetchBatchQuotes } from '../services/api';
import { useWatchlistStore } from '../store/watchlistStore';
import type { Quote } from '../types';

const TICKER_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','ORCL',
  'CRM','ADBE','INTC','NFLX','PYPL','SQ','COIN','SPY','QQQ','IWM',
  'DIA','XLK','XLF','XLE','XLV','XLY','GS','JPM','BAC','WFC',
  'V','MA','AXP','UNH','JNJ','PFE','ABBV','MRK','LLY','CVX',
  'XOM','COP','SLB','NEE','DUK','SO','D','BA','CAT','GE',
  'HON','MMM','UPS','FDX','COST','WMT','TGT','HD','LOW','NKE',
];

const SECTOR_MAP: Record<string, string> = {
  AAPL:'Tech',MSFT:'Tech',NVDA:'Tech',GOOGL:'Tech',META:'Tech',AMZN:'Tech',
  TSLA:'Auto',AMD:'Tech',AVGO:'Tech',ORCL:'Tech',CRM:'Tech',ADBE:'Tech',
  INTC:'Tech',NFLX:'Media',PYPL:'Fintech',SQ:'Fintech',COIN:'Crypto',
  SPY:'ETF',QQQ:'ETF',IWM:'ETF',DIA:'ETF',XLK:'ETF',XLF:'ETF',
  XLE:'ETF',XLV:'ETF',XLY:'ETF',GS:'Finance',JPM:'Finance',BAC:'Finance',
  WFC:'Finance',V:'Finance',MA:'Finance',AXP:'Finance',UNH:'Healthcare',
  JNJ:'Healthcare',PFE:'Healthcare',ABBV:'Healthcare',MRK:'Healthcare',LLY:'Healthcare',
  CVX:'Energy',XOM:'Energy',COP:'Energy',SLB:'Energy',NEE:'Utilities',
  DUK:'Utilities',SO:'Utilities',D:'Utilities',BA:'Industrial',CAT:'Industrial',
  GE:'Industrial',HON:'Industrial',MMM:'Industrial',UPS:'Industrial',FDX:'Industrial',
  COST:'Consumer',WMT:'Consumer',TGT:'Consumer',HD:'Consumer',LOW:'Consumer',NKE:'Consumer',
};

const SECTORS = ['All', ...Array.from(new Set(Object.values(SECTOR_MAP))).sort()];

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtVol(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toString();
}

export function Scanner() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  const [sector, setSector] = useState('All');
  const [minChange, setMinChange] = useState('');
  const [maxChange, setMaxChange] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'symbol' | 'price' | 'changePercent' | 'volume'>('changePercent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['scanner-quotes'],
    queryFn: () => fetchBatchQuotes(TICKER_UNIVERSE),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    let list = quotes;

    if (sector !== 'All') {
      list = list.filter((q) => SECTOR_MAP[q.symbol] === sector);
    }
    if (search.trim()) {
      const s = search.trim().toUpperCase();
      list = list.filter((q) => q.symbol.includes(s) || q.shortName?.toUpperCase().includes(s));
    }
    if (minChange !== '') list = list.filter((q) => q.changePercent >= Number(minChange));
    if (maxChange !== '') list = list.filter((q) => q.changePercent <= Number(maxChange));
    if (minPrice !== '') list = list.filter((q) => q.price >= Number(minPrice));
    if (maxPrice !== '') list = list.filter((q) => q.price <= Number(maxPrice));

    return [...list].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [quotes, sector, search, minChange, maxChange, minPrice, maxPrice, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function handleRowClick(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  function SortIcon({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <span className="text-border-dim ml-1">↕</span>;
    return <span className="text-accent ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-accent" />
        <h1 className="text-sm font-semibold text-white">Scanner</h1>
        {!isLoading && (
          <span className="text-xs text-text-muted ml-auto">{results.length} results</span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border-dim rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {/* Search */}
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Symbol / name…"
              className="w-full bg-bg-hover border border-border-dim rounded pl-7 pr-2 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Sector */}
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="bg-bg-hover border border-border-dim rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s === 'All' ? 'All Sectors' : s}</option>
            ))}
          </select>

          {/* % Change range */}
          <div className="flex gap-1 items-center">
            <input
              type="number"
              value={minChange}
              onChange={(e) => setMinChange(e.target.value)}
              placeholder="% min"
              className="w-full bg-bg-hover border border-border-dim rounded px-2 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
            <span className="text-text-muted text-xs shrink-0">–</span>
            <input
              type="number"
              value={maxChange}
              onChange={(e) => setMaxChange(e.target.value)}
              placeholder="% max"
              className="w-full bg-bg-hover border border-border-dim rounded px-2 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Price range */}
          <div className="flex gap-1 items-center">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="$ min"
              className="w-full bg-bg-hover border border-border-dim rounded px-2 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
            <span className="text-text-muted text-xs shrink-0">–</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="$ max"
              className="w-full bg-bg-hover border border-border-dim rounded px-2 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          onClick={() => { setSector('All'); setSearch(''); setMinChange(''); setMaxChange(''); setMinPrice(''); setMaxPrice(''); }}
          className="text-xs text-text-muted hover:text-gray-300 underline"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-dim">
                <th
                  className="text-left px-3 py-2.5 text-text-muted font-medium cursor-pointer hover:text-gray-300 whitespace-nowrap"
                  onClick={() => toggleSort('symbol')}
                >
                  Symbol <SortIcon col="symbol" />
                </th>
                <th className="text-left px-3 py-2.5 text-text-muted font-medium whitespace-nowrap hidden sm:table-cell">
                  Name
                </th>
                <th className="text-left px-3 py-2.5 text-text-muted font-medium whitespace-nowrap hidden md:table-cell">
                  Sector
                </th>
                <th
                  className="text-right px-3 py-2.5 text-text-muted font-medium cursor-pointer hover:text-gray-300 whitespace-nowrap"
                  onClick={() => toggleSort('price')}
                >
                  Price <SortIcon col="price" />
                </th>
                <th
                  className="text-right px-3 py-2.5 text-text-muted font-medium cursor-pointer hover:text-gray-300 whitespace-nowrap"
                  onClick={() => toggleSort('changePercent')}
                >
                  Chg% <SortIcon col="changePercent" />
                </th>
                <th
                  className="text-right px-3 py-2.5 text-text-muted font-medium cursor-pointer hover:text-gray-300 whitespace-nowrap hidden sm:table-cell"
                  onClick={() => toggleSort('volume')}
                >
                  Volume <SortIcon col="volume" />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border-dim/40">
                  <td className="px-3 py-2.5"><div className="h-3 bg-bg-hover rounded w-12 animate-pulse" /></td>
                  <td className="px-3 py-2.5 hidden sm:table-cell"><div className="h-3 bg-bg-hover rounded w-32 animate-pulse" /></td>
                  <td className="px-3 py-2.5 hidden md:table-cell"><div className="h-3 bg-bg-hover rounded w-16 animate-pulse" /></td>
                  <td className="px-3 py-2.5 text-right"><div className="h-3 bg-bg-hover rounded w-16 ml-auto animate-pulse" /></td>
                  <td className="px-3 py-2.5 text-right"><div className="h-3 bg-bg-hover rounded w-12 ml-auto animate-pulse" /></td>
                  <td className="px-3 py-2.5 text-right hidden sm:table-cell"><div className="h-3 bg-bg-hover rounded w-14 ml-auto animate-pulse" /></td>
                </tr>
              ))}
              {!isLoading && results.map((q) => {
                const isPos = q.changePercent >= 0;
                return (
                  <tr
                    key={q.symbol}
                    onClick={() => handleRowClick(q.symbol)}
                    className="border-b border-border-dim/40 hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-white">{q.symbol}</span>
                    </td>
                    <td className="px-3 py-2.5 text-text-muted hidden sm:table-cell truncate max-w-[160px]">
                      {q.shortName}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className="px-1.5 py-0.5 rounded bg-bg-hover text-text-muted text-[10px]">
                        {SECTOR_MAP[q.symbol] ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-200 num">
                      ${fmt(q.price)}
                    </td>
                    <td className={clsx('px-3 py-2.5 text-right font-semibold num', isPos ? 'text-green' : 'text-red-400')}>
                      {isPos ? '+' : ''}{fmt(q.changePercent)}%
                    </td>
                    <td className="px-3 py-2.5 text-right text-text-muted num hidden sm:table-cell">
                      {fmtVol(q.volume)}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && results.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
                    No results match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
