/**
 * Yahoo Finance crumb auth for native (CapacitorHttp) requests.
 *
 * Yahoo requires a session cookie + crumb for quoteSummary and options
 * endpoints (chart/screener/search are exempt). The native HTTP layer
 * stores Yahoo's cookie automatically; this module fetches and caches the
 * matching crumb, and retries once with a fresh crumb on 401/403.
 */
import { CapacitorHttp } from '@capacitor/core';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

let cachedCrumb: { crumb: string; ts: number } | null = null;
const CRUMB_TTL = 30 * 60_000;

export async function getYahooCrumb(): Promise<string> {
  if (cachedCrumb && Date.now() - cachedCrumb.ts < CRUMB_TTL) return cachedCrumb.crumb;

  // Prime the Yahoo session cookie (fc.yahoo.com 404s but sets the cookie,
  // which the native cookie store keeps for subsequent requests)
  try {
    await CapacitorHttp.get({ url: 'https://fc.yahoo.com', headers: { 'User-Agent': UA } });
  } catch {
    // expected — response is a 404/redirect; only the cookie matters
  }

  const res = await CapacitorHttp.get({
    url: 'https://query1.finance.yahoo.com/v1/test/getcrumb',
    headers: { 'User-Agent': UA, Accept: 'text/plain' },
  });
  const crumb = typeof res.data === 'string' ? res.data.trim() : '';
  if (res.status !== 200 || !crumb || crumb.startsWith('<')) {
    throw new Error('Failed to obtain Yahoo Finance session');
  }
  cachedCrumb = { crumb, ts: Date.now() };
  return crumb;
}

export function invalidateYahooCrumb(): void {
  cachedCrumb = null;
}

/** GET a crumb-protected Yahoo URL; retries once with a fresh crumb on 401/403. */
export async function yahooCrumbGet(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const crumb = await getYahooCrumb();
    const sep = url.includes('?') ? '&' : '?';
    const res = await CapacitorHttp.get({
      url: `${url}${sep}crumb=${encodeURIComponent(crumb)}`,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      invalidateYahooCrumb();
      continue;
    }
    if (res.status !== 200) throw new Error(`Yahoo Finance returned ${res.status}`);
    return res.data;
  }
  throw new Error('Yahoo Finance authorization failed');
}
