import YahooFinance from 'yahoo-finance2';
import axios from 'axios';

// Instantiate to avoid 'this' context issues
const yahooFinance = new YahooFinance();

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
    return new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
  }
  return Math.floor((now - (map[period] ?? 90 * day)) / 1000);
}

export async function getQuote(symbol: string): Promise<Quote> {
  const r = await yahooFinance.quote(symbol);
  return {
    symbol: r.symbol,
    shortName: (r as any).shortName || (r as any).longName || symbol,
    price: (r as any).regularMarketPrice ?? 0,
    change: (r as any).regularMarketChange ?? 0,
    changePercent: (r as any).regularMarketChangePercent ?? 0,
    volume: (r as any).regularMarketVolume ?? 0,
    avgVolume: (r as any).averageDailyVolume3Month ?? 0,
    marketCap: (r as any).marketCap ?? null,
    open: (r as any).regularMarketOpen ?? 0,
    high: (r as any).regularMarketDayHigh ?? 0,
    low: (r as any).regularMarketDayLow ?? 0,
    previousClose: (r as any).regularMarketPreviousClose ?? 0,
    fiftyTwoWeekHigh: (r as any).fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: (r as any).fiftyTwoWeekLow ?? 0,
    pe: (r as any).trailingPE ?? null,
    eps: (r as any).epsTrailingTwelveMonths ?? null,
    marketState: (r as any).marketState ?? 'CLOSED',
    currency: (r as any).currency ?? 'USD',
  };
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
  const period1 = computePeriod1(period);
  const period2 = Math.floor(Date.now() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const params = { period1, period2, interval, includePrePost: false };

  try {
    const { data } = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradeEdge/1.0)',
      },
      timeout: 10000,
    });

    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: number[] = quote.open ?? [];
    const highs: number[] = quote.high ?? [];
    const lows: number[] = quote.low ?? [];
    const closes: number[] = quote.close ?? [];
    const volumes: number[] = quote.volume ?? [];

    return timestamps
      .map((t, i) => ({
        time: t,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i] ?? 0,
      }))
      .filter((b) => b.open != null && b.close != null);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch history for ${symbol}: ${msg}`);
  }
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const day = now.getUTCDay();

  // ET offset: -5 (EST) or -4 (EDT) — approximate with -5
  const etTotalMinutes = ((utcHour - 5 + 24) % 24) * 60 + utcMinute;
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const isWeekday = day >= 1 && day <= 5;

  return isWeekday && etTotalMinutes >= marketOpen && etTotalMinutes < marketClose;
}
