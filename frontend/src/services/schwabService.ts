/**
 * Schwab Trader API - Individual
 * OAuth 2.0 + real-time market data + options chain with Greeks
 *
 * Setup (after Schwab approves your developer access):
 * 1. Go to developer.schwab.com → My Apps → Create App
 * 2. Set the Callback URL to exactly: https://127.0.0.1
 *    (Schwab only accepts HTTPS callback URLs — custom schemes are rejected
 *    with "We are unable to complete your request")
 * 3. Wait until the app status is "Ready For Use" (not "Approved - Pending")
 * 4. Copy App Key (Client ID) and Secret → paste in TradeEdge Settings
 * 5. Tap "Connect Schwab Account" → log in → the browser lands on a
 *    https://127.0.0.1/?code=... page that won't load — copy that URL from
 *    the address bar and paste it back into Settings to finish connecting.
 */
import { Capacitor } from '@capacitor/core';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHWAB_AUTH_URL = 'https://api.schwabapi.com/v1/oauth/authorize';
const SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';
const SCHWAB_API_BASE = 'https://api.schwabapi.com/marketdata/v1';
const REDIRECT_URI = 'https://127.0.0.1';

const LS_ACCESS_TOKEN = 'SCHWAB_ACCESS_TOKEN';
const LS_REFRESH_TOKEN = 'SCHWAB_REFRESH_TOKEN';
const LS_TOKEN_EXPIRY = 'SCHWAB_TOKEN_EXPIRY';
const LS_CLIENT_ID = 'TRADEEDGE_SCHWAB_CLIENT_ID';
const LS_CLIENT_SECRET = 'TRADEEDGE_SCHWAB_CLIENT_SECRET';

// ─── Token management ─────────────────────────────────────────────────────────

export interface SchwabTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export function getSchwabTokens(): SchwabTokens | null {
  const accessToken = localStorage.getItem(LS_ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);
  const expiresAt = Number(localStorage.getItem(LS_TOKEN_EXPIRY) ?? '0');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, expiresAt };
}

export function saveSchwabTokens(tokens: SchwabTokens) {
  localStorage.setItem(LS_ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(LS_REFRESH_TOKEN, tokens.refreshToken);
  localStorage.setItem(LS_TOKEN_EXPIRY, String(tokens.expiresAt));
}

export function clearSchwabTokens() {
  localStorage.removeItem(LS_ACCESS_TOKEN);
  localStorage.removeItem(LS_REFRESH_TOKEN);
  localStorage.removeItem(LS_TOKEN_EXPIRY);
}

export function isSchwabConnected(): boolean {
  return !!localStorage.getItem(LS_ACCESS_TOKEN);
}

export function getSchwabClientId(): string {
  return localStorage.getItem(LS_CLIENT_ID) ?? '';
}

export function getSchwabClientSecret(): string {
  return localStorage.getItem(LS_CLIENT_SECRET) ?? '';
}

function isTokenExpired(): boolean {
  const expiry = Number(localStorage.getItem(LS_TOKEN_EXPIRY) ?? '0');
  return Date.now() >= expiry - 60_000; // refresh 1 min before expiry
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

/** Open Schwab login page. User copies the https://127.0.0.1/?code=... URL back. */
export async function startSchwabOAuth() {
  const clientId = getSchwabClientId();
  if (!clientId) throw new Error('Enter your Schwab Client ID in Settings first.');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'readonly',
  });

  const authUrl = `${SCHWAB_AUTH_URL}?${params.toString()}`;

  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: authUrl });
  } else {
    window.open(authUrl, '_blank', 'width=600,height=700');
  }
}

/**
 * Extract the authorization code from whatever the user pasted —
 * the full https://127.0.0.1/?code=...&session=... URL or just the code.
 * Schwab codes end in '@' which arrives URL-encoded as %40.
 */
export function extractSchwabCode(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const match = raw.match(/[?&]code=([^&\s]+)/);
  const code = match ? match[1] : raw;
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

/** POST to Schwab's token endpoint — CapacitorHttp on native (browser fetch is CORS-blocked) */
async function schwabTokenPost(body: URLSearchParams, credentials: string): Promise<{ ok: boolean; status: number; data: any }> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const res = await CapacitorHttp.post({
      url: SCHWAB_TOKEN_URL,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: body.toString(),
    });
    return { ok: res.status === 200, status: res.status, data: res.data };
  }
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
}

/** Exchange authorization code for access + refresh tokens */
export async function exchangeSchwabCode(code: string): Promise<void> {
  const clientId = getSchwabClientId();
  const clientSecret = getSchwabClientSecret();
  if (!clientId || !clientSecret) throw new Error('Schwab Client ID and Secret required.');

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });

  const res = await schwabTokenPost(body, credentials);
  if (!res.ok) {
    throw new Error(
      res.status === 400
        ? 'Token exchange failed — the code may have expired (they last ~30 seconds). Tap Connect and try again.'
        : `Token exchange failed (${res.status}) — check your Client ID and Secret.`
    );
  }
  const data = res.data;

  saveSchwabTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  });
}

/** Refresh access token using refresh token */
export async function refreshSchwabToken(): Promise<string> {
  const tokens = getSchwabTokens();
  if (!tokens) throw new Error('Not connected to Schwab.');

  const clientId = getSchwabClientId();
  const clientSecret = getSchwabClientSecret();
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });

  const res = await schwabTokenPost(body, credentials);
  if (!res.ok) {
    clearSchwabTokens();
    throw new Error('Schwab session expired. Please reconnect in Settings.');
  }

  const data = res.data;
  saveSchwabTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
  });

  return data.access_token;
}

/** Get a valid access token, refreshing if needed */
async function getAccessToken(): Promise<string> {
  if (isTokenExpired()) {
    return refreshSchwabToken();
  }
  return getSchwabTokens()!.accessToken;
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function schwabGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const token = await getAccessToken();
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const url = `${SCHWAB_API_BASE}${path}${qs}`;

  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const res = await CapacitorHttp.get({
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (res.status === 401) { clearSchwabTokens(); throw new Error('Schwab session expired. Reconnect in Settings.'); }
    if (res.status !== 200) throw new Error(`Schwab API error (${res.status})`);
    return res.data;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 401) { clearSchwabTokens(); throw new Error('Schwab session expired. Reconnect in Settings.'); }
  if (!res.ok) throw new Error(`Schwab API error (${res.status})`);
  return res.json();
}

// ─── Market Data ─────────────────────────────────────────────────────────────

import type { Quote, OHLCVBar } from '../types';

function parseSchwabQuote(raw: Record<string, unknown>, symbol: string): Quote {
  const q = (raw[symbol] as Record<string, unknown>) ?? raw;
  const ref = (q.reference as Record<string, unknown>) ?? {};
  const quote = (q.quote as Record<string, unknown>) ?? {};
  const regular = (q.regular as Record<string, unknown>) ?? {};

  const price = (quote.lastPrice as number) ?? (regular.regularMarketLastPrice as number) ?? 0;
  const previousClose = (quote.closePrice as number) ?? (regular.regularMarketPreviousClose as number) ?? 0;
  const change = price - previousClose;

  return {
    symbol: (ref.symbol as string) ?? symbol,
    shortName: (ref.description as string) ?? symbol,
    price,
    change,
    changePercent: previousClose > 0 ? (change / previousClose) * 100 : 0,
    open: (quote.openPrice as number) ?? 0,
    high: (quote.highPrice as number) ?? 0,
    low: (quote.lowPrice as number) ?? 0,
    previousClose,
    volume: (quote.totalVolume as number) ?? 0,
    avgVolume: 0,
    marketCap: null,
    fiftyTwoWeekHigh: (quote['52WeekHigh'] as number) ?? 0,
    fiftyTwoWeekLow: (quote['52WeekLow'] as number) ?? 0,
    pe: (ref.peRatio as number | null) ?? null,
    eps: (ref.eps as number | null) ?? null,
    marketState: (quote.tradingHours as string) ?? 'REGULAR',
    currency: 'USD',
  };
}

export async function fetchSchwabQuote(symbol: string): Promise<Quote> {
  const data = await schwabGet('/quotes', { symbols: symbol, fields: 'quote,reference,regular' });
  return parseSchwabQuote(data as Record<string, unknown>, symbol);
}

export async function fetchSchwabBatchQuotes(symbols: string[]): Promise<Quote[]> {
  const data = await schwabGet('/quotes', { symbols: symbols.join(','), fields: 'quote,reference,regular' });
  const map = data as Record<string, unknown>;
  return symbols
    .filter((s) => map[s])
    .map((s) => parseSchwabQuote(map, s));
}

const SCHWAB_PERIOD_MAP: Record<string, { periodType: string; period: string; frequencyType: string; frequency: string }> = {
  '5m':  { periodType: 'day',   period: '10',  frequencyType: 'minute', frequency: '5'  },
  '15m': { periodType: 'day',   period: '10',  frequencyType: 'minute', frequency: '15' },
  '30m': { periodType: 'month', period: '1',   frequencyType: 'minute', frequency: '30' },
  '60m': { periodType: 'month', period: '3',   frequencyType: 'minute', frequency: '60' },
  '1d':  { periodType: 'year',  period: '5',   frequencyType: 'daily',  frequency: '1'  },
  '1wk': { periodType: 'year',  period: '20',  frequencyType: 'weekly', frequency: '1'  },
};

export async function fetchSchwabHistory(symbol: string, _period: string, interval: string): Promise<OHLCVBar[]> {
  const cfg = SCHWAB_PERIOD_MAP[interval] ?? SCHWAB_PERIOD_MAP['1d'];
  const data = await schwabGet('/pricehistory', {
    symbol,
    periodType: cfg.periodType,
    period: cfg.period,
    frequencyType: cfg.frequencyType,
    frequency: cfg.frequency,
    needExtendedHoursData: 'false',
  });

  const candles: Record<string, unknown>[] = (data as any)?.candles ?? [];
  return candles.map((c) => ({
    time: Math.floor((c.datetime as number) / 1000),
    open: c.open as number,
    high: c.high as number,
    low: c.low as number,
    close: c.close as number,
    volume: c.volume as number,
  }));
}

// ─── Options Chain ────────────────────────────────────────────────────────────

import type { OptionsChain, OptionContract } from './nativeOptions';

export async function fetchSchwabOptions(symbol: string, expirationDate?: number): Promise<OptionsChain> {
  const params: Record<string, string> = {
    symbol,
    contractType: 'ALL',
    includeUnderlyingQuote: 'true',
    strategy: 'SINGLE',
  };

  if (expirationDate) {
    const d = new Date(expirationDate * 1000);
    params.fromDate = d.toISOString().slice(0, 10);
    params.toDate = d.toISOString().slice(0, 10);
  }

  const data = await schwabGet('/chains', params);
  const raw = data as Record<string, unknown>;

  const underlyingPrice = (raw.underlyingPrice as number) ?? 0;
  const expirationDates: string[] = [];
  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];

  function parseContracts(map: Record<string, unknown>, type: 'call' | 'put', target: OptionContract[]) {
    for (const [expDate, strikeMap] of Object.entries(map)) {
      if (!expirationDates.includes(expDate)) expirationDates.push(expDate);
      for (const contracts of Object.values(strikeMap as Record<string, unknown>)) {
        for (const c of contracts as Record<string, unknown>[]) {
          target.push({
            strike: (c.strikePrice as number) ?? 0,
            bid: (c.bid as number) ?? 0,
            ask: (c.ask as number) ?? 0,
            lastPrice: (c.last as number) ?? 0,
            volume: (c.totalVolume as number | null) ?? null,
            openInterest: (c.openInterest as number | null) ?? null,
            impliedVolatility: c.volatility != null ? Number(((c.volatility as number) * 100).toFixed(2)) : null,
            inTheMoney: (c.inTheMoney as boolean) ?? false,
            expiration: expDate.slice(0, 10),
            contractSymbol: (c.symbol as string) ?? '',
            // Greeks (Schwab provides these natively)
            delta: (c.delta as number | null) ?? null,
            gamma: (c.gamma as number | null) ?? null,
            theta: (c.theta as number | null) ?? null,
            vega: (c.vega as number | null) ?? null,
          } as OptionContract & { delta?: number | null; gamma?: number | null; theta?: number | null; vega?: number | null });
        }
      }
    }
  }

  if (raw.callExpDateMap) parseContracts(raw.callExpDateMap as Record<string, unknown>, 'call', calls);
  if (raw.putExpDateMap) parseContracts(raw.putExpDateMap as Record<string, unknown>, 'put', puts);

  // Sort expiration timestamps for selector
  const expTimestamps = expirationDates
    .map((d) => String(Math.floor(new Date(d).getTime() / 1000)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  return { symbol, expirationDates: expTimestamps, calls, puts, underlyingPrice };
}
