import { useQuery } from '@tanstack/react-query';
import { fetchEarningsCalendar, hasFinnhubKey, type EarningsDate } from '../services/finnhubService';

export function useEarnings(symbol: string | null) {
  return useQuery<EarningsDate[]>({
    queryKey: ['earnings', symbol],
    queryFn: () => fetchEarningsCalendar(symbol!),
    enabled: !!symbol && hasFinnhubKey(),
    staleTime: 60 * 60_000,     // 1 hour
    retry: 1,
  });
}
