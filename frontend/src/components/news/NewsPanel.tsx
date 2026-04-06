import { useState } from 'react';
import clsx from 'clsx';
import { ChevronUp, ChevronDown, Newspaper, ExternalLink } from 'lucide-react';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useNews } from '../../hooks/useNews';
import type { NewsItem } from '../../services/newsService';

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

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <button
      onClick={() => openLink(item.link)}
      className="flex items-start gap-2 px-3 py-2 hover:bg-bg-hover w-full text-left transition-colors border-b border-panel/50 last:border-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 leading-snug line-clamp-2">{item.title}</p>
        <p className="text-[10px] text-text-muted mt-0.5">
          {item.publisher} · {timeAgo(item.publishedAt)}
        </p>
      </div>
      <ExternalLink className="w-3 h-3 text-text-muted/50 shrink-0 mt-0.5" />
    </button>
  );
}

interface NewsPanelProps {
  className?: string;
}

export function NewsPanel({ className }: NewsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const { data: news = [], isLoading } = useNews(selectedSymbol);

  return (
    <div className={clsx('flex flex-col bg-bg-secondary border-t border-panel shrink-0', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-3 h-8 hover:bg-bg-hover transition-colors text-left w-full shrink-0"
      >
        <Newspaper className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          News
          {selectedSymbol && <span className="ml-1 text-accent"> · {selectedSymbol}</span>}
        </span>
        {isLoading && <div className="w-3 h-3 border border-border-dim border-t-accent rounded-full animate-spin ml-1" />}
        <span className="ml-auto text-text-muted">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="overflow-y-auto" style={{ maxHeight: '160px' }}>
          {!selectedSymbol && (
            <p className="px-3 py-3 text-xs text-text-muted">Select a symbol to see news.</p>
          )}
          {selectedSymbol && news.length === 0 && !isLoading && (
            <p className="px-3 py-3 text-xs text-text-muted">No news found for {selectedSymbol}.</p>
          )}
          {news.map((item) => (
            <NewsRow key={item.uuid} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
