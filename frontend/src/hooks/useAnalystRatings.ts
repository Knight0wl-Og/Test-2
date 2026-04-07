import { useQuery } from '@tanstack/react-query';
import { fetchAnalystRatings, hasFinnhubKey, type AnalystRating } from '../services/finnhubService';

export function useAnalystRatings(symbol: string | null) {
  return useQuery<AnalystRating[]>({
    queryKey: ['analyst', symbol],
    queryFn: () => fetchAnalystRatings(symbol!),
    enabled: !!symbol && hasFinnhubKey(),
    staleTime: 24 * 60 * 60_000, // 24 hours
    retry: 1,
  });
}
