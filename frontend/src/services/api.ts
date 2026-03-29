import axios from 'axios';
import type { Quote, OHLCVBar, SectorData, FearGreedData, WatchlistGroup } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 15000,
});

// ---- Quotes ----

export async function fetchQuote(symbol: string): Promise<Quote> {
  const { data } = await api.get<Quote>(`/api/quotes/${symbol}`);
  return data;
}

export async function fetchBatchQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  const { data } = await api.get<Quote[]>('/api/quotes/batch', {
    params: { symbols: symbols.join(',') },
  });
  return data;
}

export async function fetchHistory(
  symbol: string,
  period = '3mo',
  interval = '1d'
): Promise<OHLCVBar[]> {
  const { data } = await api.get<OHLCVBar[]>(`/api/quotes/${symbol}/history`, {
    params: { period, interval },
  });
  return data;
}

// ---- Market ----

export async function fetchIndices(): Promise<Quote[]> {
  const { data } = await api.get<Quote[]>('/api/market/indices');
  return data;
}

export async function fetchSectors(): Promise<SectorData[]> {
  const { data } = await api.get<SectorData[]>('/api/market/sectors');
  return data;
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  const { data } = await api.get<FearGreedData>('/api/market/fear-greed');
  return data;
}

export async function fetchMarketStatus(): Promise<{ marketOpen: boolean }> {
  const { data } = await api.get<{ marketOpen: boolean }>('/api/market/status');
  return data;
}

// ---- Watchlists ----

export async function fetchWatchlists(): Promise<WatchlistGroup[]> {
  const { data } = await api.get<WatchlistGroup[]>('/api/watchlists');
  return data;
}

export async function createWatchlist(name: string, color: string): Promise<WatchlistGroup> {
  const { data } = await api.post<WatchlistGroup>('/api/watchlists', { name, color });
  return { ...data, symbols: [] };
}

export async function updateWatchlist(
  id: string,
  updates: Partial<{ name: string; color: string; position: number }>
): Promise<WatchlistGroup> {
  const { data } = await api.put<WatchlistGroup>(`/api/watchlists/${id}`, updates);
  return data;
}

export async function deleteWatchlist(id: string): Promise<void> {
  await api.delete(`/api/watchlists/${id}`);
}

export async function addSymbolToWatchlist(groupId: string, symbol: string): Promise<void> {
  await api.post(`/api/watchlists/${groupId}/symbols`, { symbol });
}

export async function removeSymbolFromWatchlist(groupId: string, symbol: string): Promise<void> {
  await api.delete(`/api/watchlists/${groupId}/symbols/${symbol}`);
}
