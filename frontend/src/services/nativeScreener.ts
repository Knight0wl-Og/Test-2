// Yahoo Finance predefined screeners — real market-wide gainers/losers/actives.
// Replaces the hardcoded 60-symbol TICKER_UNIVERSE previously used by
// TopMovers and Scanner.

import { CapacitorHttp } from '@capacitor/core';
import type { Quote } from '../types';

export type ScreenerId = 'day_gainers' | 'day_losers' | 'most_actives';

const YF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept: 'application/json',
};

function screenerUrl(host: string, scrId: ScreenerId, count: number): string {
  return `https://${host}/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=${count}&formatted=false`;
}

/** Map raw Yahoo screener quotes into the app-wide Quote shape. */
export function parseScreenerQuotes(data: unknown): Quote[] {
  const quotes: any[] = (data as any)?.finance?.result?.[0]?.quotes ?? [];
  if (!Array.isArray(quotes) || quotes.length === 0) {
    throw new Error('Screener returned no results');
  }
  return quotes.map((q) => {
    const price = q.regularMarketPrice ?? 0;
    return {
      symbol: q.symbol ?? '',
      shortName: q.shortName ?? q.longName ?? q.symbol ?? '',
      price,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
      avgVolume: q.averageDailyVolume3Month ?? 0,
      marketCap: q.marketCap ?? null,
      open: q.regularMarketOpen ?? price,
      high: q.regularMarketDayHigh ?? price,
      low: q.regularMarketDayLow ?? price,
      previousClose: q.regularMarketPreviousClose ?? 0,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
      pe: q.trailingPE ?? null,
      eps: q.epsTrailingTwelveMonths ?? null,
      marketState: q.marketState ?? 'CLOSED',
      currency: q.currency ?? 'USD',
    };
  });
}

export async function fetchScreenerNative(scrId: ScreenerId, count = 25): Promise<Quote[]> {
  // query1 occasionally rejects screener calls in some regions — retry on query2.
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const res = await CapacitorHttp.get({
      url: screenerUrl(host, scrId, count),
      headers: YF_HEADERS,
    });
    if (res.status === 200 && (res.data as any)?.finance?.result?.[0]?.quotes?.length) {
      return parseScreenerQuotes(res.data);
    }
  }
  throw new Error('Failed to load screener data from Yahoo Finance');
}
