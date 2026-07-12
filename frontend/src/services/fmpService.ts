import { Capacitor, CapacitorHttp } from '@capacitor/core';

const LS_KEY = 'tradeedge_fmp_key';
const FMP_BASE = 'https://financialmodelingprep.com/api';

/** Thrown when FMP returns 403 — the endpoint needs a paid plan. */
export class FmpUpgradeRequiredError extends Error {
  constructor() {
    super('This feature requires a paid FMP plan (free tier does not include this endpoint)');
    this.name = 'FmpUpgradeRequiredError';
  }
}

export function getFmpKey(): string { return localStorage.getItem(LS_KEY) ?? ''; }
export function setFmpKey(k: string): void {
  if (k.trim()) localStorage.setItem(LS_KEY, k.trim());
  else localStorage.removeItem(LS_KEY);
}

function getBackendBase(): string {
  return localStorage.getItem('TRADEEDGE_API_URL') || 'http://localhost:3001';
}

async function fmpFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = getFmpKey();
  if (!key) throw new Error('FMP API key not set — add it in Settings');

  if (Capacitor.isNativePlatform()) {
    const searchParams = new URLSearchParams({ ...params, apikey: key });
    const res = await CapacitorHttp.get({ url: `${FMP_BASE}/${path}?${searchParams}` });
    if (res.status === 401) throw new Error('Invalid FMP API key — check Settings');
    if (res.status === 403) throw new FmpUpgradeRequiredError();
    if (res.status === 429) throw new Error('FMP rate limit reached — try again in a minute');
    if (res.status !== 200) throw new Error(`FMP error ${res.status}`);
    return res.data as T;
  }

  // Web/Electron: backend proxy (key stored server-side or forwarded in header)
  const query = new URLSearchParams(params).toString();
  const url = `${getBackendBase()}/api/market/fmp/${path}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    headers: { 'x-fmp-key': key },
  });
  if (res.status === 401) throw new Error('Invalid FMP API key — check Settings');
  if (res.status === 403) throw new FmpUpgradeRequiredError();
  if (res.status === 429) throw new Error('FMP rate limit reached — try again in a minute');
  if (!res.ok) throw new Error(`FMP proxy error ${res.status}`);
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FMPEarningsEvent {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
  time: string;
  updatedFromDate: string | null;
  fiscalDateEnding: string;
}

export interface FMPHistoricalEarnings {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  revenueEstimated: number | null;
  revenue: number | null;
  surprisePercent: number | null;
}

export interface FMPAnalystEstimate {
  date: string;
  symbol: string;
  estimatedRevenueAvg: number;
  estimatedEpsAvg: number;
  estimatedEpsHigh: number;
  estimatedEpsLow: number;
  numberAnalystsEstimatedEps: number;
}

export interface FMPIncomeStatement {
  date: string;
  symbol: string;
  period: string;
  revenue: number;
  grossProfit: number;
  netIncome: number;
  eps: number;
  epsDiluted: number;
  ebitda: number;
  operatingIncome: number;
  netIncomeRatio: number;
}

export interface FMPKeyMetrics {
  symbol: string;
  date: string;
  period: string;
  pe: number;
  pbRatio: number;
  priceToSalesRatio: number;
  enterpriseValueOverEBITDA: number;
  enterpriseValue: number;
  roe: number;
  dividendYield: number;
  earningsYield: number;
  freeCashFlowYield: number;
  marketCap: number;
}

export interface FMPFinancialRatios {
  symbol: string;
  date: string;
  grossProfitMargin: number;
  operatingProfitMargin: number;
  netProfitMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  debtEquityRatio: number;
  currentRatio: number;
  priceEarningsRatio: number;
  priceToBookRatio: number;
  priceToSalesRatio: number;
}

export interface FMPDividend {
  date: string;
  label: string;
  adjDividend: number;
  symbol: string;
  dividend: number;
  recordDate: string;
  paymentDate: string;
  declarationDate: string;
}

export interface FMPGeneralNews {
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
}

export interface FMPEconomicEvent {
  event: string;
  date: string;
  country: string;
  actual: number | null;
  previous: number | null;
  consensus: number | null;
  impact: 'Low' | 'Medium' | 'High';
  unit: string;
}

export interface FMPEtfHolder {
  asset: string;
  name: string;
  sharesNumber: number;
  weightPercentage: number;
  marketValue: number;
  updated: string;
}

export interface FMPTechnicalIndicator {
  date: string;
  close: number;
  ema?: number;
  rsi?: number;
  sma?: number;
  macd?: number;
  signal?: number;
  histogram?: number;
}

// ─── Earnings ────────────────────────────────────────────────────────────────

export async function fetchEarningsCalendarFMP(from: string, to: string): Promise<FMPEarningsEvent[]> {
  return fmpFetch('v3/earning_calendar', { from, to });
}

export async function fetchEarningsHistoryFMP(symbol: string, limit = 8): Promise<FMPHistoricalEarnings[]> {
  return fmpFetch(`v3/historical/earning_calendar/${encodeURIComponent(symbol)}`, { limit: String(limit) });
}

export async function fetchAnalystEstimatesFMP(symbol: string, period: 'quarter' | 'annual' = 'quarter'): Promise<FMPAnalystEstimate[]> {
  return fmpFetch(`v3/analyst-estimates/${encodeURIComponent(symbol)}`, { period, limit: '4' });
}

export async function fetchIncomeStatementFMP(
  symbol: string,
  period: 'quarter' | 'annual' = 'quarter',
  limit = 12
): Promise<FMPIncomeStatement[]> {
  return fmpFetch(`v3/income-statement/${encodeURIComponent(symbol)}`, {
    period,
    limit: String(limit),
  });
}

// ─── Valuation & Ratios ───────────────────────────────────────────────────────

export async function fetchKeyMetricsFMP(symbol: string): Promise<FMPKeyMetrics[]> {
  return fmpFetch(`v3/key-metrics/${encodeURIComponent(symbol)}`, { limit: '4' });
}

export async function fetchFinancialRatiosFMP(symbol: string): Promise<FMPFinancialRatios[]> {
  return fmpFetch(`v3/financial-ratios/${encodeURIComponent(symbol)}`, { limit: '4' });
}

// ─── Dividends ────────────────────────────────────────────────────────────────

export async function fetchDividendHistoryFMP(symbol: string): Promise<FMPDividend[]> {
  const data = await fmpFetch<{ symbol: string; historical: FMPDividend[] }>(
    `v3/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}`
  );
  return data.historical ?? [];
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function fetchGeneralNewsFMP(page = 0): Promise<FMPGeneralNews[]> {
  return fmpFetch('v3/general_news', { page: String(page) });
}

export async function fetchStockNewsFMP(symbol: string, limit = 10): Promise<FMPGeneralNews[]> {
  return fmpFetch('v3/stock_news', { tickers: symbol.toUpperCase(), limit: String(limit) });
}

// ─── Economic Calendar ────────────────────────────────────────────────────────

export async function fetchEconomicCalendarFMP(from: string, to: string): Promise<FMPEconomicEvent[]> {
  return fmpFetch('v3/economic_calendar', { from, to });
}

// ─── ETF ──────────────────────────────────────────────────────────────────────

export async function fetchEtfHoldersFMP(etfSymbol: string): Promise<FMPEtfHolder[]> {
  return fmpFetch(`v4/etf-holder/${encodeURIComponent(etfSymbol)}`);
}

// ─── Cash Flow Statement ─────────────────────────────────────────────────────

export interface FMPCashFlowStatement {
  date: string;
  symbol: string;
  period: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  commonStockRepurchased: number;
  netIncome: number;
  dividendsPaid: number;
}

export async function fetchCashFlowStatementFMP(
  symbol: string,
  period: 'quarter' | 'annual' = 'quarter',
  limit = 4
): Promise<FMPCashFlowStatement[]> {
  return fmpFetch(`v3/cash-flow-statement/${encodeURIComponent(symbol)}`, {
    period,
    limit: String(limit),
  });
}

// ─── Price Target ────────────────────────────────────────────────────────────

export interface FMPPriceTargetConsensus {
  symbol: string;
  targetHigh: number | null;
  targetLow: number | null;
  targetConsensus: number | null;
  targetMedian: number | null;
}

/** Returns null on 403/error so callers can silently degrade */
export async function fetchPriceTargetConsensusFMP(
  symbol: string
): Promise<FMPPriceTargetConsensus | null> {
  try {
    const data = await fmpFetch<FMPPriceTargetConsensus[]>(`v4/price-target-consensus`, { symbol });
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch {
    return null;
  }
}

// ─── Technicals ───────────────────────────────────────────────────────────────

export async function fetchTechnicalIndicatorFMP(
  symbol: string,
  type: 'rsi' | 'ema' | 'sma' | 'macd',
  period = 14
): Promise<FMPTechnicalIndicator[]> {
  return fmpFetch(`v3/technical_indicator/daily/${encodeURIComponent(symbol)}`, {
    period: String(period),
    type,
    limit: '60',
  });
}
