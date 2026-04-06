import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number; // unix seconds
  thumbnail?: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch recent news for a symbol using Yahoo Finance's search API.
 * Works on Android (CapacitorHttp) and Electron/web (fetch).
 * No API key required.
 */
export async function fetchNewsForSymbol(symbol: string, count = 15): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${count}&quotesCount=0`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    Accept: 'application/json',
  };

  let rawNews: Array<Record<string, unknown>>;

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    if (res.status !== 200) throw new Error(`Yahoo returned ${res.status}`);
    rawNews = res.data?.news ?? [];
  } else {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
    const json = await res.json();
    rawNews = json?.news ?? [];
  }

  return rawNews.map((n) => ({
    uuid: (n.uuid as string) ?? String(Math.random()),
    title: (n.title as string) ?? '',
    publisher: (n.publisher as string) ?? '',
    link: (n.link as string) ?? '',
    publishedAt: (n.providerPublishTime as number) ?? 0,
    thumbnail: (n.thumbnail as { resolutions?: Array<{ url: string }> } | undefined)
      ?.resolutions?.[0]?.url,
  }));
}
