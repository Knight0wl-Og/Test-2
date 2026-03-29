import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../services/api';
import type { OHLCVBar } from '../types';

export function useHistory(
  symbol: string | null,
  period = '3mo',
  interval = '1d'
) {
  return useQuery<OHLCVBar[]>({
    queryKey: ['history', symbol, period, interval],
    queryFn: () => fetchHistory(symbol!, period, interval),
    enabled: !!symbol,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
