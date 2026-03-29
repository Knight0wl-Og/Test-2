import { useQuery } from '@tanstack/react-query';
import { fetchIndices, fetchSectors, fetchFearGreed, fetchMarketStatus } from '../services/api';
import type { Quote, SectorData, FearGreedData } from '../types';

export function useIndices() {
  return useQuery<Quote[]>({
    queryKey: ['market', 'indices'],
    queryFn: fetchIndices,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSectors() {
  return useQuery<SectorData[]>({
    queryKey: ['market', 'sectors'],
    queryFn: fetchSectors,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}

export function useFearGreed() {
  return useQuery<FearGreedData>({
    queryKey: ['market', 'fear-greed'],
    queryFn: fetchFearGreed,
    refetchInterval: 60 * 60_000,
    staleTime: 30 * 60_000,
  });
}

export function useMarketStatus() {
  return useQuery<{ marketOpen: boolean }>({
    queryKey: ['market', 'status'],
    queryFn: fetchMarketStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
