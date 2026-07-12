import { Capacitor, CapacitorHttp } from '@capacitor/core';

const MAX_SYMBOLS = 30;

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

