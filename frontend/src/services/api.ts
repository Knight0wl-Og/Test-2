import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import type { Quote, OHLCVBar, SectorData, FearGreedData, WatchlistGroup } from '../types';
import {
  fetchQuoteNative, fetchBatchQuotesNative, fetchHistoryNative,
  fetchIndicesNative, fetchSectorsNative, fetchFearGreedNative, fetchMarketStatusNative,
} from './nativeMarket';
import { fetchEarningsThisWeekNative } from './earningsSync';
import {
  fetchWatchlistsNative, createWatchlistNative, updateWatchlistNative,
  deleteWatchlistNative, addSymbolToWatchlistNative, removeSymbolFromWatchlistNative,
} from './nativeWatchlist';
import { fetchResearchNative, type ResearchData } from './nativeResearch';
import { fetchScreenerNative, parseScreenerQuotes, type ScreenerId } from './nativeScreener';
import { fetchOptionsNative, type OptionsChain } from './nativeOptions';
import {
  isSchwabConnected,
  fetchSchwabQuote, fetchSchwabBatchQuotes,
  fetchSchwabHistory, fetchSchwabOptions,
} from './schwabService';

// On Android (Capacitor native), bypass the backend entirely.
// On Electron/Web, use the backend API as normal.
const isNative = () => Capacitor.isNativePlatform();
const useSchwab = () => isSchwabConnected();

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
  if (useSchwab()) return fetchSchwabQuote(symbol);
  if (isNative()) return fetchQuoteNative(symbol);
  const { data } = await api.get<Quote>(`/api/quotes/${symbol}`);
  return data;
}

export async function fetchBatchQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  if (useSchwab()) return fetchSchwabBatchQuotes(symbols);
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
  if (useSchwab()) return fetchSchwabHistory(symbol, period, interval);
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

export async function fetchEarningsThisWeek(): Promise<string[]> {
  if (isNative()) return fetchEarningsThisWeekNative();
  const { data } = await api.get<string[]>('/api/market/earnings-week');
  return data;
}

// ---- Screener ----

export type { ScreenerId };

export async function fetchScreener(scrId: ScreenerId, count = 25): Promise<Quote[]> {
  if (isNative()) return fetchScreenerNative(scrId, count);
  const { data } = await api.get('/api/market/screener', { params: { scrIds: scrId, count } });
  return parseScreenerQuotes(data);
}

// ---- Research ----

export async function fetchResearch(symbol: string): Promise<ResearchData> {
  if (isNative()) return fetchResearchNative(symbol);
  const { data } = await api.get<ResearchData>(`/api/market/research/${symbol}`);
  return data;
}

// ---- Options ----

export async function fetchOptions(symbol: string, expirationDate?: number): Promise<OptionsChain> {
  if (useSchwab()) return fetchSchwabOptions(symbol, expirationDate);
  if (isNative()) return fetchOptionsNative(symbol, expirationDate);
  const { data } = await api.get<OptionsChain>(`/api/market/options/${symbol}`, {
    params: expirationDate ? { date: expirationDate } : undefined,
  });
  return data;
}

// ---- AI Copilot ----

interface MarketSnapshot {
  fearGreed: { value: number; valueText: string };
  vix: number | null;
  topGainers: Array<{ symbol: string; changePercent: number }>;
  topLosers: Array<{ symbol: string; changePercent: number }>;
  sectors: Array<{ name: string; changePercent: number }>;
}

export async function fetchCopilotAnalysis(snapshot: MarketSnapshot): Promise<string> {
  const apiKey = localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY') || '';

  if (isNative()) {
    // On Android: call Anthropic API directly via CapacitorHttp
    const { CapacitorHttp } = await import('@capacitor/core');
    const movers_universe = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','JPM','GS'];
    const gainers = snapshot.topGainers.slice(0, 5).map((g) => `${g.symbol} +${g.changePercent.toFixed(2)}%`).join(', ');
    const losers = snapshot.topLosers.slice(0, 5).map((l) => `${l.symbol} ${l.changePercent.toFixed(2)}%`).join(', ');
    const sectorSummary = snapshot.sectors.slice(0, 6).map((s) => `${s.name}: ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`).join(', ');

    const prompt = `You are a concise market analyst. Analyse the following current market data and provide a brief, insightful summary (3-4 paragraphs) covering market sentiment, key movers, sector rotation, and any notable observations. Be direct and avoid generic disclaimers.\n\nMarket Data:\n- Fear & Greed Index: ${snapshot.fearGreed?.value ?? 'N/A'} (${snapshot.fearGreed?.valueText ?? 'N/A'})\n- VIX: ${snapshot.vix?.toFixed(2) ?? 'N/A'}\n- Top Gainers: ${gainers}\n- Top Losers: ${losers}\n- Sector Performance: ${sectorSummary}\n\nWrite a concise market analysis:`;

    const res = await CapacitorHttp.post({
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      data: {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      },
    });

    if (res.status === 401) throw new Error('Invalid Anthropic API key. Check your key in Settings.');
    if (res.status === 429) throw new Error('Anthropic rate limit reached. Try again in a moment.');
    if (res.status !== 200) throw new Error('Failed to generate analysis.');

    return res.data?.content?.[0]?.text ?? '';
  }

  // Electron/Web: proxy through backend
  const { data } = await api.post<{ analysis: string; error?: string }>(
    '/api/copilot/analyse',
    snapshot,
    { headers: apiKey ? { 'x-anthropic-key': apiKey } : {} }
  );

  if (data.error) throw new Error(data.error);
  return data.analysis;
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
