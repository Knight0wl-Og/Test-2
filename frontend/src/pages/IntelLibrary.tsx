import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { fetchGeneralNewsFMP, fetchStockNewsFMP, getFmpKey } from '../services/fmpService';
import { useWatchlistStore } from '../store/watchlistStore';
import clsx from 'clsx';

type Tab = 'market' | 'stock';

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

async function openUrl(url: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } catch { window.open(url, '_blank'); }
  } else {
    window.open(url, '_blank');
  }
}

export function IntelLibrary() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [tab, setTab] = useState<Tab>('market');
  const [stockInput, setStockInput] = useState(storeSymbol ?? 'AAPL');
  const [stockSymbol, setStockSymbol] = useState(storeSymbol ?? 'AAPL');
  const hasFmpKey = !!getFmpKey();

  const marketQuery = useQuery({
    queryKey: ['fmp-general-news'],
    queryFn: () => fetchGeneralNewsFMP(0),
    enabled: hasFmpKey && tab === 'market',
    staleTime: 5 * 60 * 1000,
  });

  const stockQuery = useQuery({
    queryKey: ['fmp-stock-news', stockSymbol],
    queryFn: () => fetchStockNewsFMP(stockSymbol, 20),
    enabled: hasFmpKey && tab === 'stock' && !!stockSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const items = tab === 'market' ? (marketQuery.data ?? []) : (stockQuery.data ?? []);
  const isLoading = tab === 'market' ? marketQuery.isLoading : stockQuery.isLoading;
  const error = tab === 'market' ? marketQuery.error : stockQuery.error;

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-4 h-4 text-sky-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Intel Library</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['market', 'stock'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
              tab === t ? 'bg-accent text-white' : 'bg-bg-card text-text-muted hover:text-white border border-border-dim'
            )}
          >
            {t === 'market' ? 'Market News' : 'Stock News'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <form
          onSubmit={(e) => { e.preventDefault(); setStockSymbol(stockInput.trim().toUpperCase()); }}
          className="flex gap-2 mb-4"
        >
          <input
            value={stockInput}
            onChange={(e) => setStockInput(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Symbol"
            className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
          />
          <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
            Load
          </button>
        </form>
      )}

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">FMP API Key Required</p>
          <p className="text-xs text-text-muted">Add your free FMP key in Settings</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Failed to load news'}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => openUrl(item.url)}
            className="w-full flex gap-3 bg-bg-card hover:bg-bg-hover border border-border-dim rounded-lg p-3 text-left transition-colors"
          >
            {item.image && (
              <img
                src={item.image}
                alt=""
                className="w-14 h-14 rounded object-cover shrink-0 bg-bg-hover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white leading-snug line-clamp-2 mb-1">{item.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-accent">{item.site}</span>
                <span className="text-[10px] text-text-muted">{timeAgo(item.publishedDate)}</span>
                <ExternalLink className="w-2.5 h-2.5 text-text-muted ml-auto shrink-0" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
