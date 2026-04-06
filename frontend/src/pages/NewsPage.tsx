/**
 * Mobile full-page news feed — mirrors TradingView mobile's News tab.
 */
import { useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { useNews } from '../hooks/useNews';
import { useWatchlistStore } from '../store/watchlistStore';
import type { NewsItem } from '../services/newsService';

function timeAgo(ts: number): string {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

async function openLink(url: string) {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener noreferrer');
  }
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <button
      onClick={() => openLink(item.link)}
      className="w-full flex items-start gap-3 px-3 py-3 border-b border-panel hover:bg-bg-hover active:bg-bg-hover transition-colors text-left"
    >
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt=""
          className="w-16 h-12 object-cover rounded shrink-0 bg-bg-card"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 leading-snug line-clamp-3">{item.title}</p>
        <p className="text-[11px] text-text-muted mt-1">
          {item.publisher} · {timeAgo(item.publishedAt)}
        </p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-text-muted/50 shrink-0 mt-1" />
    </button>
  );
}

export function NewsPage() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [searchTerm, setSearchTerm] = useState(selectedSymbol ?? 'market');
  const [activeSymbol, setActiveSymbol] = useState(selectedSymbol ?? 'market');
  const { data: news = [], isLoading } = useNews(activeSymbol);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const s = searchTerm.trim().toUpperCase() || 'market';
    setActiveSymbol(s);
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-panel bg-bg-secondary shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              placeholder="Symbol or topic…"
              className="w-full bg-bg-card border border-border-dim rounded pl-8 pr-3 py-1.5 text-sm text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-accent-hover text-white rounded px-3 py-1.5 text-sm transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-3 border-b border-panel">
                <div className="w-16 h-12 bg-bg-card rounded animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-bg-card rounded animate-pulse" />
                  <div className="h-3 bg-bg-card rounded w-3/4 animate-pulse" />
                  <div className="h-2 bg-bg-card rounded w-1/2 animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && news.length === 0 && (
          <div className="p-6 text-center text-sm text-text-muted">
            No news found for "{activeSymbol}"
          </div>
        )}
        {news.map((item) => (
          <NewsCard key={item.uuid} item={item} />
        ))}
      </div>
    </div>
  );
}
