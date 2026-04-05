import { useQuery } from '@tanstack/react-query';
import { fetchBatchQuotes, fetchQuote } from '../services/api';
import { checkAlerts } from '../services/alertsService';
import type { Quote } from '../types';

export function useQuotes(symbols: string[], refetchMs = 60_000) {
  return useQuery<Quote[]>({
    queryKey: ['quotes', symbols.slice().sort().join(',')],
    queryFn: async () => {
      const quotes = await fetchBatchQuotes(symbols);
      // Check price alerts on each quote refresh
      checkAlerts(quotes);
      return quotes;
    },
    enabled: symbols.length > 0,
    refetchInterval: refetchMs,
    staleTime: 30_000,
  });
}

export function useQuote(symbol: string | null, refetchMs = 60_000) {
  return useQuery<Quote>({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol!),
    enabled: !!symbol,
    refetchInterval: refetchMs,
    staleTime: 30_000,
  });
}
