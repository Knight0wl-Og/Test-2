import { useQuery } from '@tanstack/react-query';
import { fetchOptions } from '../services/api';
import type { OptionsChain } from '../services/nativeOptions';

export function useOptions(symbol: string | null, expirationDate?: number) {
  return useQuery<OptionsChain>({
    queryKey: ['options', symbol, expirationDate],
    queryFn: () => fetchOptions(symbol!, expirationDate),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
}
