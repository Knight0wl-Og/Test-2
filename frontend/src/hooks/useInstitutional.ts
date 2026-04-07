import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionalHolders, type MajorHolders } from '../services/institutionalService';

export function useInstitutional(symbol: string | null) {
  return useQuery<MajorHolders>({
    queryKey: ['institutional', symbol],
    queryFn: () => fetchInstitutionalHolders(symbol!),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000, // 24 hours — 13F is quarterly
    retry: 1,
  });
}
