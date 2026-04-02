import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import type { Quote, OHLCVBar, SectorData, FearGreedData, WatchlistGroup } from '../types';
import {
  fetchQuoteNative, fetchBatchQuotesNative, fetchHistoryNative,
  fetchIndicesNative, fetchSectorsNative, fetchFearGreedNative, fetchMarketStatusNative,
} from './nativeMarket';
import {
  fetchWatchlistsNative, createWatchlistNative, updateWatchlistNative,
  deleteWatchlistNative, addSymbolToWatchlistNative, removeSymbolFromWatchlistNative,
} from './nativeWatchlist';

// On Android (Capacitor native), bypass the backend entirely.
// On Electron/Web, use the backend API as normal.
const isNative = () => Capacitor.isNativePlatform();

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('TRADEEDGE_API_URL');
    if (override) return override;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
}

const api = axios.create({ baseURL: getBaseUrl(), timeout: 15000 });

// ---- Quotes ----

export async function fetchQuote(symbol: string): Promise<Quote> {
  if (isNative()) return fetchQuoteNative(symbol);
  const { data } = await api.get<Quote>(`/api/quotes/${symbol}`);
  return data;
}

export async function fetchBatchQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  if (isNative()) return fetchBatchQuotesNative(symbols);
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
  if (isNative()) return fetchHistoryNative(symbol, period, interval);
  const { data } = await api.get<OHLCVBar[]>(`/api/quotes/${symbol}/history`, {
    params: { period, interval },
  });
  return data;
}

// ---- Market ----

export async function fetchIndices(): Promise<Quote[]> {
  if (isNative()) return fetchIndicesNative();
  const { data } = await api.get<Quote[]>('/api/market/indices');
  return data;
}

export async function fetchSectors(): Promise<SectorData[]> {
  if (isNative()) return fetchSectorsNative();
  const { data } = await api.get<SectorData[]>('/api/market/sectors');
  return data;
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  if (isNative()) return fetchFearGreedNative();
  const { data } = await api.get<FearGreedData>('/api/market/fear-greed');
  return data;
}

export async function fetchMarketStatus(): Promise<{ marketOpen: boolean }> {
  if (isNative()) return fetchMarketStatusNative();
  const { data } = await api.get<{ marketOpen: boolean }>('/api/market/status');
  return data;
}

// ---- Watchlists ----

export async function fetchWatchlists(): Promise<WatchlistGroup[]> {
  if (isNative()) return fetchWatchlistsNative();
  const { data } = await api.get<WatchlistGroup[]>('/api/watchlists');
  return data;
}

export async function createWatchlist(name: string, color: string): Promise<WatchlistGroup> {
  if (isNative()) return createWatchlistNative(name, color);
  const { data } = await api.post<WatchlistGroup>('/api/watchlists', { name, color });
  return { ...data, symbols: [] };
}

export async function updateWatchlist(
  id: string,
  updates: Partial<{ name: string; color: string; position: number }>
): Promise<WatchlistGroup> {
  if (isNative()) return updateWatchlistNative(id, updates);
  const { data } = await api.put<WatchlistGroup>(`/api/watchlists/${id}`, updates);
  return data;
}

export async function deleteWatchlist(id: string): Promise<void> {
  if (isNative()) return deleteWatchlistNative(id);
  await api.delete(`/api/watchlists/${id}`);
}

export async function addSymbolToWatchlist(groupId: string, symbol: string): Promise<void> {
  if (isNative()) return addSymbolToWatchlistNative(groupId, symbol);
  await api.post(`/api/watchlists/${groupId}/symbols`, { symbol });
}

export async function removeSymbolFromWatchlist(groupId: string, symbol: string): Promise<void> {
  if (isNative()) return removeSymbolFromWatchlistNative(groupId, symbol);
  await api.delete(`/api/watchlists/${groupId}/symbols/${symbol}`);
}
