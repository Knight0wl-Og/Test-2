import { useQuery } from '@tanstack/react-query';
import { fetchNewsForSymbol, type NewsItem } from '../services/newsService';

export function useNews(symbol: string | null) {
  return useQuery<NewsItem[]>({
    queryKey: ['news', symbol],
    queryFn: () => fetchNewsForSymbol(symbol!),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
