import { useQuery } from '@tanstack/react-query';
import { fetchGeneralNewsFMP, getFmpKey } from '../../services/fmpService';
import { ExternalLink } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1)  return `${h}h ago`;
  if (m >= 1)  return `${m}m ago`;
  return 'just now';
}

export function MarketNewsFeed() {
  const hasFmp = !!getFmpKey();

  const { data: news = [], isLoading } = useQuery({
    queryKey: ['market-news-feed'],
    queryFn: () => fetchGeneralNewsFMP(0),
    enabled: hasFmp,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-bold tracking-widest text-gray-400">MARKET NEWS</span>
        <span className="text-[8px] bg-green-400/20 text-green-400 px-1 py-0.5 rounded font-bold">LIVE</span>
      </div>

      {!hasFmp && (
        <p className="text-[11px] text-gray-600 text-center py-4">FMP key required</p>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {news.slice(0, 20).map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-2 rounded-lg hover:bg-bg-card/60 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-200 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-gray-500">{item.site}</span>
                <span className="text-[9px] text-gray-600">·</span>
                <span className="text-[9px] text-gray-500">{timeAgo(item.publishedDate)}</span>
              </div>
            </div>
            <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}
