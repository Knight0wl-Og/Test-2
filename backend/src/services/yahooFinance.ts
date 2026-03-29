import axios from 'axios';
import { getMockQuote, getMockHistory } from './mockData';

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

export interface Quote {
  symbol: string;
  shortName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number | null;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  pe: number | null;
  eps: number | null;
  marketState: string;
  currency: string;
}

export interface OHLCVBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function computePeriod1(period: string): number {
  const now = Date.now();
  const day = 86400 * 1000;
  const map: Record<string, number> = {
    '1d': 1 * day,
    '5d': 5 * day,
    '1mo': 30 * day,
    '3mo': 90 * day,
    '6mo': 180 * day,
    '1y': 365 * day,
    '2y': 730 * day,
    '5y': 1825 * day,
  };
  if (period === 'ytd') {
    return Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
  }
  return Math.floor((now - (map[period] ?? 90 * day)) / 1000);
}

export async function getQuote(symbol: string): Promise<Quote> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const { data } = await axios.get(url, {
      params: { interval: '1d', range: '1d', includePrePost: false },
      headers: YF_HEADERS,
      timeout: 10000,
    });

    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`No data returned for ${symbol}`);

    const meta = result.meta as Record<string, unknown>;
    const price = (meta.regularMarketPrice as number) ?? 0;
    const previousClose = (meta.previousClose as number) ?? (meta.chartPreviousClose as number) ?? 0;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: (meta.symbol as string) ?? symbol,
      shortName: (meta.shortName as string) || (meta.longName as string) || symbol,
      price,
      change,
      changePercent,
      volume: (meta.regularMarketVolume as number) ?? 0,
      avgVolume: 0,
      marketCap: null,
      open: (meta.regularMarketOpen as number) ?? price,
      high: (meta.regularMarketDayHigh as number) ?? price,
      low: (meta.regularMarketDayLow as number) ?? price,
      previousClose,
      fiftyTwoWeekHigh: (meta.fiftyTwoWeekHigh as number) ?? 0,
      fiftyTwoWeekLow: (meta.fiftyTwoWeekLow as number) ?? 0,
      pe: null,
      eps: null,
      marketState: (meta.marketState as string) ?? 'CLOSED',
      currency: (meta.currency as string) ?? 'USD',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.debug(`[mock] getQuote(${symbol}): ${msg}`);
    return getMockQuote(symbol);
  }
}

export async function getBatchQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map(getQuote));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function getHistory(
  symbol: string,
  period: string = '3mo',
  interval: string = '1d'
): Promise<OHLCVBar[]> {
  try {
    const period1 = computePeriod1(period);
    const period2 = Math.floor(Date.now() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const { data } = await axios.get(url, {
      params: { period1, period2, interval, includePrePost: false },
      headers: YF_HEADERS,
      timeout: 12000,
    });

    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const opens: (number | null)[] = q.open ?? [];
    const highs: (number | null)[] = q.high ?? [];
    const lows: (number | null)[] = q.low ?? [];
    const closes: (number | null)[] = q.close ?? [];
    const volumes: (number | null)[] = q.volume ?? [];

    return timestamps
      .map((t, i) => ({
        time: t,
        open: opens[i] ?? 0,
        high: highs[i] ?? 0,
        low: lows[i] ?? 0,
        close: closes[i] ?? 0,
        volume: volumes[i] ?? 0,
      }))
      .filter((b) => b.open !== 0 && b.close !== 0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.debug(`[mock] getHistory(${symbol}): ${msg}`);
    return getMockHistory(symbol, 90);
  }
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const day = now.getUTCDay();

  // ET offset: approximate with -5 (EST); DST would be -4 but close enough
  const etTotalMinutes = ((utcHour - 5 + 24) % 24) * 60 + utcMinute;
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const isWeekday = day >= 1 && day <= 5;

  return isWeekday && etTotalMinutes >= marketOpen && etTotalMinutes < marketClose;
}
