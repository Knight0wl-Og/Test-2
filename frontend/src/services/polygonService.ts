import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const BASE = 'https://api.polygon.io';
const getKey = () => localStorage.getItem('TRADEEDGE_POLYGON_KEY') ?? '';

export interface PolygonOptionContract {
  contractType: 'call' | 'put';
  strike: number;
  expiration: string;       // YYYY-MM-DD
  ticker: string;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  bid: number;
  ask: number;
  lastPrice: number;
  inTheMoney: boolean;
  underlyingPrice: number;
}

async function polyGet(path: string): Promise<unknown> {
  const key = getKey();
  if (!key) throw new Error('No Polygon.io API key');
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}apiKey=${key}`;

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } });
    if (res.status !== 200) throw new Error(`Polygon ${res.status}`);
    return res.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon ${res.status}`);
  return res.json();
}

/**
 * Fetch top options contracts by volume for a symbol.
 * Free tier: 15-min delayed, unlimited calls.
 */
export async function fetchOptionsSnapshot(
  symbol: string,
  type: 'call' | 'put' = 'call',
  limit = 50,
): Promise<PolygonOptionContract[]> {
  const data = await polyGet(
    `/v3/snapshot/options/${symbol.toUpperCase()}?contract_type=${type}&limit=${limit}&sort=volume&order=desc`
  );
  const results: Record<string, unknown>[] = (data as any)?.results ?? [];

  return results.map((r) => {
    const details = (r.details ?? {}) as Record<string, unknown>;
    const greeks = (r.greeks ?? {}) as Record<string, unknown>;
    const day = (r.day ?? {}) as Record<string, unknown>;
    const lastQuote = (r.last_quote ?? {}) as Record<string, unknown>;

    return {
      contractType: (details.contract_type as 'call' | 'put') ?? type,
      strike: (details.strike_price as number) ?? 0,
      expiration: (details.expiration_date as string) ?? '',
      ticker: (r.ticker as string) ?? '',
      volume: (day.volume as number) ?? 0,
      openInterest: (r.open_interest as number) ?? 0,
      impliedVolatility: r.implied_volatility != null ? Math.round((r.implied_volatility as number) * 100) : null,
      delta: (greeks.delta as number | null) ?? null,
      gamma: (greeks.gamma as number | null) ?? null,
      theta: (greeks.theta as number | null) ?? null,
      vega: (greeks.vega as number | null) ?? null,
      bid: (lastQuote.bid as number) ?? 0,
      ask: (lastQuote.ask as number) ?? 0,
      lastPrice: (day.close as number) ?? 0,
      inTheMoney: (r.in_the_money as boolean) ?? false,
      underlyingPrice: ((r.underlying_asset as Record<string, unknown>)?.price as number) ?? 0,
    };
  });
}

export function hasPolygonKey() {
  return !!getKey();
}
