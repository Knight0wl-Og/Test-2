import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CACHE_KEY = 'tradeedge_earnings_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const WATCHLIST_KEY = 'tradeedge_watchlists';
const EARNINGS_GROUP_ID = 'g4';
const MAX_SYMBOLS = 30;

interface EarningsCache {
  weekKey: string;
  fetchedAt: number;
  symbols: string[];
}

function getISOWeekKey(): string {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86_400_000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekDates(): Date[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function extractSymbol(raw: string): string {
  // Handle HTML anchor: <a href="/...">AAPL</a>
  const anchor = raw.match(/>([A-Z.]{1,6})</);
  if (anchor) return anchor[1];
  const plain = raw.trim().toUpperCase();
  return /^[A-Z.]{1,6}$/.test(plain) ? plain : '';
}

async function fetchDayEarnings(date: string): Promise<string[]> {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
    Accept: 'application/json, text/plain, */*',
  };
  try {
    let data: unknown;
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({ url, headers });
      data = res.data;
    } else {
      const res = await fetch(url, { headers });
      data = await res.json();
    }
    const rows: Array<{ symbol: string }> = (data as any)?.data?.rows ?? [];
    return rows
      .map((r) => extractSymbol(r.symbol))
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

export async function fetchEarningsThisWeekNative(): Promise<string[]> {
  const dates = getWeekDates().map(formatDate);
  const results = await Promise.allSettled(dates.map(fetchDayEarnings));
  const all = new Set<string>();
  for (const r of results) {
    if (r.status === 'fulfilled') r.value.forEach((s) => all.add(s));
  }
  return Array.from(all).slice(0, MAX_SYMBOLS);
}

export async function syncEarningsWatchlist(): Promise<void> {
  try {
    // Check cache validity
    const weekKey = getISOWeekKey();
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as EarningsCache | null;
    if (cached && cached.weekKey === weekKey && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      // Cache is fresh — still apply to watchlist in case it was reset
      applyToWatchlist(cached.symbols);
      return;
    }

    // Fetch new data
    const symbols = await fetchEarningsThisWeekNative();
    if (symbols.length === 0) return; // Don't overwrite on failure

    // Save cache
    const newCache: EarningsCache = { weekKey, fetchedAt: Date.now(), symbols };
    localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));

    applyToWatchlist(symbols);
  } catch (err) {
    console.warn('[earningsSync] failed:', err);
  }
}

function applyToWatchlist(symbols: string[]): void {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return;
    const groups = JSON.parse(raw);
    const group = groups.find((g: { id: string }) => g.id === EARNINGS_GROUP_ID);
    if (group) {
      group.symbols = symbols;
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(groups));
    }
  } catch {
    // ignore
  }
}
