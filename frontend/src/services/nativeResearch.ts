import { CapacitorHttp } from '@capacitor/core';

export interface ResearchData {
  symbol: string;
  shortName: string;
  longBusinessSummary: string;
  sector: string;
  industry: string;
  website: string;
  employees: number | null;
  // Key stats
  trailingPE: number | null;
  forwardPE: number | null;
  eps: number | null;
  revenuePerShare: number | null;
  returnOnEquity: number | null;
  profitMargins: number | null;
  revenueGrowth: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  totalRevenue: number | null;
  // Analyst consensus
  recommendationMean: number | null;
  targetMeanPrice: number | null;
  numberOfAnalystOpinions: number | null;
  recommendationBuy: number;
  recommendationHold: number;
  recommendationSell: number;
}

export async function fetchResearchNative(symbol: string): Promise<ResearchData> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,financialData,recommendationTrend,assetProfile,defaultKeyStatistics`;

  const res = await CapacitorHttp.get({
    url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: 'application/json',
    },
  });

  if (res.status !== 200) throw new Error(`Yahoo Finance returned ${res.status}`);

  const result = res.data?.quoteSummary?.result?.[0];
  if (!result) throw new Error('No data returned');

  const profile = result.assetProfile ?? {};
  const financials = result.financialData ?? {};
  const keyStats = result.defaultKeyStatistics ?? {};
  const reco = result.recommendationTrend?.trend?.[0] ?? {};

  return {
    symbol: symbol.toUpperCase(),
    shortName: profile.longName ?? symbol,
    longBusinessSummary: profile.longBusinessSummary ?? '',
    sector: profile.sector ?? '',
    industry: profile.industry ?? '',
    website: profile.website ?? '',
    employees: profile.fullTimeEmployees ?? null,
    trailingPE: keyStats.trailingPE?.raw ?? null,
    forwardPE: keyStats.forwardPE?.raw ?? null,
    eps: keyStats.trailingEps?.raw ?? null,
    revenuePerShare: financials.revenuePerShare?.raw ?? null,
    returnOnEquity: financials.returnOnEquity?.raw ?? null,
    profitMargins: financials.profitMargins?.raw ?? null,
    revenueGrowth: financials.revenueGrowth?.raw ?? null,
    debtToEquity: financials.debtToEquity?.raw ?? null,
    currentRatio: financials.currentRatio?.raw ?? null,
    totalRevenue: financials.totalRevenue?.raw ?? null,
    recommendationMean: financials.recommendationMean?.raw ?? null,
    targetMeanPrice: financials.targetMeanPrice?.raw ?? null,
    numberOfAnalystOpinions: financials.numberOfAnalystOpinions?.raw ?? null,
    recommendationBuy: (reco.strongBuy ?? 0) + (reco.buy ?? 0),
    recommendationHold: reco.hold ?? 0,
    recommendationSell: (reco.sell ?? 0) + (reco.strongSell ?? 0),
  };
}
