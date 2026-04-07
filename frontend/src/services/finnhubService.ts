import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const BASE = 'https://finnhub.io/api/v1';
const getKey = () => localStorage.getItem('TRADEEDGE_FINNHUB_KEY') ?? '';

export interface EarningsDate {
  date: string;           // YYYY-MM-DD
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  surprise: number | null; // % surprise
}

export interface AnalystRating {
  period: string;         // YYYY-MM-DD (month of report)
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

async function fhGet(path: string): Promise<unknown> {
  const key = getKey();
  if (!key) throw new Error('No Finnhub API key');
  const url = `${BASE}${path}&token=${key}`;

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } });
    if (res.status !== 200) throw new Error(`Finnhub ${res.status}`);
    return res.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

/** Past + upcoming earnings for symbol (last 4 + next 2 quarters) */
export async function fetchEarningsCalendar(symbol: string): Promise<EarningsDate[]> {
  const now = new Date();
  const from = new Date(now); from.setFullYear(from.getFullYear() - 2);
  const to = new Date(now); to.setFullYear(to.getFullYear() + 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await fhGet(`/calendar/earnings?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}`);
  const rows: Record<string, unknown>[] = (data as any)?.earningsCalendar ?? [];

  return rows
    .filter((r) => r.date)
    .map((r) => ({
      date: r.date as string,
      epsEstimate: (r.epsEstimate as number | null) ?? null,
      epsActual: (r.epsActual as number | null) ?? null,
      revenueEstimate: (r.revenueEstimate as number | null) ?? null,
      revenueActual: (r.revenueActual as number | null) ?? null,
      surprise: r.epsActual != null && r.epsEstimate != null && (r.epsEstimate as number) !== 0
        ? (((r.epsActual as number) - (r.epsEstimate as number)) / Math.abs(r.epsEstimate as number)) * 100
        : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Analyst buy/hold/sell recommendation trend (last 4 months) */
export async function fetchAnalystRatings(symbol: string): Promise<AnalystRating[]> {
  const data = await fhGet(`/stock/recommendation?symbol=${symbol}`);
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  return rows.slice(0, 4).map((r) => ({
    period: r.period as string,
    strongBuy: (r.strongBuy as number) ?? 0,
    buy: (r.buy as number) ?? 0,
    hold: (r.hold as number) ?? 0,
    sell: (r.sell as number) ?? 0,
    strongSell: (r.strongSell as number) ?? 0,
  }));
}

export function hasFinnhubKey() {
  return !!getKey();
}
