import { CapacitorHttp } from '@capacitor/core';
import type { Quote, OHLCVBar, SectorData, FearGreedData } from '../types';

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept: 'application/json',
};

const INDICES = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX', '^GSPC', '^IXIC', '^RUT'];

const SECTORS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLY', name: 'Consumer Disc.' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Comm. Services' },
];

async function yfGet(symbol: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`;
  const response = await CapacitorHttp.get({ url, headers: YF_HEADERS });
  return response.data;
}

function parseMeta(meta: Record<string, unknown>, symbol: string): Quote {
  const price = (meta.regularMarketPrice as number) ?? 0;
  const previousClose = (meta.previousClose as number) ?? (meta.chartPreviousClose as number) ?? 0;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  return {
    symbol: (meta.symbol as string) ?? symbol,
    shortName: (meta.shortName as string) || (meta.longName as string) || symbol,
    price, change, changePercent,
    volume: (meta.regularMarketVolume as number) ?? 0,
    avgVolume: 0,
    marketCap: null,
    open: (meta.regularMarketOpen as number) ?? price,
    high: (meta.regularMarketDayHigh as number) ?? price,
    low: (meta.regularMarketDayLow as number) ?? price,
    previousClose,
    fiftyTwoWeekHigh: (meta.fiftyTwoWeekHigh as number) ?? 0,
    fiftyTwoWeekLow: (meta.fiftyTwoWeekLow as number) ?? 0,
    pe: null, eps: null,
    marketState: (meta.marketState as string) ?? 'CLOSED',
    currency: (meta.currency as string) ?? 'USD',
  };
}

function blankQuote(symbol: string): Quote {
  return {
    symbol, shortName: symbol, price: 0, change: 0, changePercent: 0,
    volume: 0, avgVolume: 0, marketCap: null,
    open: 0, high: 0, low: 0, previousClose: 0,
    fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0,
    pe: null, eps: null, marketState: 'CLOSED', currency: 'USD',
  };
}

export async function fetchQuoteNative(symbol: string): Promise<Quote> {
  try {
    const data = await yfGet(symbol, { interval: '1d', range: '1d', includePrePost: 'false' });
    const result = (data as any)?.chart?.result?.[0];
    if (!result) return blankQuote(symbol);
    return parseMeta(result.meta, symbol);
  } catch {
    return blankQuote(symbol);
  }
}

export async function fetchBatchQuotesNative(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map(fetchQuoteNative));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
    .map((r) => r.value);
}

function periodToTimestamp(period: string): string {
  const now = Date.now();
  const day = 86_400_000;
  const map: Record<string, number> = {
    '1d': day, '5d': 5 * day, '1mo': 30 * day, '3mo': 90 * day,
    '6mo': 180 * day, '1y': 365 * day, '2y': 730 * day, '5y': 1825 * day,
  };
  if (period === 'ytd') {
    return String(Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000));
  }
  return String(Math.floor((now - (map[period] ?? 90 * day)) / 1000));
}

export async function fetchHistoryNative(
  symbol: string,
  period = '3mo',
  interval = '1d'
): Promise<OHLCVBar[]> {
  try {
    const period1 = periodToTimestamp(period);
    const period2 = String(Math.floor(Date.now() / 1000));
    const data = await yfGet(symbol, { period1, period2, interval, includePrePost: 'false' });
    const result = (data as any)?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    return timestamps
      .map((t, i) => ({
        time: t,
        open: q.open?.[i] ?? 0,
        high: q.high?.[i] ?? 0,
        low: q.low?.[i] ?? 0,
        close: q.close?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter((b) => b.open !== 0 && b.close !== 0);
  } catch {
    return [];
  }
}

export async function fetchIndicesNative(): Promise<Quote[]> {
  return fetchBatchQuotesNative(INDICES);
}

export async function fetchSectorsNative(): Promise<SectorData[]> {
  const quotes = await fetchBatchQuotesNative(SECTORS.map((s) => s.symbol));
  return SECTORS.map((s) => {
    const q = quotes.find((q) => q.symbol === s.symbol);
    return { ...s, price: q?.price ?? 0, changePercent: q?.changePercent ?? 0 };
  });
}

export async function fetchFearGreedNative(): Promise<FearGreedData> {
  try {
    const response = await CapacitorHttp.get({ url: 'https://api.alternative.me/fng/?limit=30' });
    const entries: Array<{ value: string; value_classification: string }> = response.data.data;
    const pick = (i: number) => {
      const e = entries[Math.min(i, entries.length - 1)];
      return { value: Number(e.value), valueText: e.value_classification };
    };
    return { fgi: { now: pick(0), previousClose: pick(1), oneWeekAgo: pick(7), oneMonthAgo: pick(29) } };
  } catch {
    return {
      fgi: {
        now: { value: 50, valueText: 'Neutral' },
        previousClose: { value: 50, valueText: 'Neutral' },
        oneWeekAgo: { value: 50, valueText: 'Neutral' },
        oneMonthAgo: { value: 50, valueText: 'Neutral' },
      },
    };
  }
}

export async function fetchMarketStatusNative(): Promise<{ marketOpen: boolean }> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const day = now.getUTCDay();
  const etMinutes = ((utcHour - 5 + 24) % 24) * 60 + utcMinute;
  const isWeekday = day >= 1 && day <= 5;
  return { marketOpen: isWeekday && etMinutes >= 570 && etMinutes < 960 };
}
