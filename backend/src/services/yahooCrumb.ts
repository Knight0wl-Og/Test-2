/**
 * Yahoo Finance cookie + crumb auth for server-side requests.
 * quoteSummary and options endpoints require it; chart/screener do not.
 * Cached for 30 minutes; callers retry once with a fresh crumb on 401/403.
 */
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

let cached: { cookie: string; crumb: string; ts: number } | null = null;
const TTL = 30 * 60_000;

export async function getYahooAuth(): Promise<{ cookie: string; crumb: string }> {
  if (cached && Date.now() - cached.ts < TTL) return cached;

  // fc.yahoo.com 404s but sets the session cookie
  const r = await axios.get('https://fc.yahoo.com', {
    validateStatus: () => true,
    headers: { 'User-Agent': UA },
    timeout: 8000,
  });
  const cookie = (r.headers['set-cookie'] ?? [])
    .map((c: string) => c.split(';')[0])
    .join('; ');

  const cr = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
    timeout: 8000,
  });
  const crumb = String(cr.data).trim();
  if (!crumb || crumb.startsWith('<')) throw new Error('Failed to obtain Yahoo crumb');

  cached = { cookie, crumb, ts: Date.now() };
  return cached;
}

export function invalidateYahooAuth(): void {
  cached = null;
}

/** GET a crumb-protected Yahoo URL; retries once with fresh auth on 401/403. */
export async function yahooAuthGet(url: string): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie, crumb } = await getYahooAuth();
    const sep = url.includes('?') ? '&' : '?';
    const r = await axios.get(`${url}${sep}crumb=${encodeURIComponent(crumb)}`, {
      validateStatus: () => true,
      headers: { 'User-Agent': UA, Accept: 'application/json', Cookie: cookie },
      timeout: 10000,
    });
    if (r.status === 401 || r.status === 403) {
      invalidateYahooAuth();
      continue;
    }
    if (r.status !== 200) throw new Error(`Yahoo Finance returned ${r.status}`);
    return r.data;
  }
  throw new Error('Yahoo Finance authorization failed');
}
