import { yahooCrumbGet } from './yahooCrumb';

export interface EpsTrendPeriod {
  endDate: string;
  avgEps: number | null;
  lowEps: number | null;
  highEps: number | null;
  numberOfAnalysts: number | null;
  growth: number | null;
}

export interface EpsTrend {
  currentQuarter: EpsTrendPeriod | null;
  nextQuarter: EpsTrendPeriod | null;
  currentYear: EpsTrendPeriod | null;
  nextYear: EpsTrendPeriod | null;
}

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
  dividendYield: number | null;
  // Analyst consensus
  recommendationMean: number | null;
  recommendationKey: string | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  numberOfAnalystOpinions: number | null;
  recommendationBuy: number;
  recommendationHold: number;
  recommendationSell: number;
  // Forward EPS estimates (Yahoo earningsTrend)
  epsTrend: EpsTrend;
}

/** Parse the Yahoo quoteSummary earningsTrend module into per-period estimates. */
export function parseEarningsTrend(result: any): EpsTrend {
  const trend: any[] = result?.earningsTrend?.trend ?? [];
  const byPeriod = (period: string): EpsTrendPeriod | null => {
    const entry = trend.find((t) => t.period === period);
    if (!entry) return null;
    const est = entry.earningsEstimate ?? {};
    return {
      endDate: entry.endDate ?? '',
      avgEps: est.avg?.raw ?? null,
      lowEps: est.low?.raw ?? null,
      highEps: est.high?.raw ?? null,
      numberOfAnalysts: est.numberOfAnalysts?.raw ?? null,
      growth: entry.growth?.raw ?? null,
    };
  };
  return {
    currentQuarter: byPeriod('0q'),
    nextQuarter: byPeriod('+1q'),
    currentYear: byPeriod('0y'),
    nextYear: byPeriod('+1y'),
  };
}

export async function fetchResearchNative(symbol: string): Promise<ResearchData> {
  // quoteSummary requires Yahoo cookie+crumb auth (handled by yahooCrumbGet)
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,financialData,recommendationTrend,assetProfile,defaultKeyStatistics,earningsTrend`;
  const data = await yahooCrumbGet(url);

  const result = (data as any)?.quoteSummary?.result?.[0];
  if (!result) throw new Error('No data returned');

  const profile = result.assetProfile ?? {};
  const financials = result.financialData ?? {};
  const keyStats = result.defaultKeyStatistics ?? {};
  const summary = result.summaryDetail ?? {};
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
    dividendYield: summary.dividendYield?.raw ?? summary.trailingAnnualDividendYield?.raw ?? null,
    recommendationMean: financials.recommendationMean?.raw ?? null,
    recommendationKey: financials.recommendationKey ?? null,
    targetMeanPrice: financials.targetMeanPrice?.raw ?? null,
    targetHighPrice: financials.targetHighPrice?.raw ?? null,
    targetLowPrice: financials.targetLowPrice?.raw ?? null,
    numberOfAnalystOpinions: financials.numberOfAnalystOpinions?.raw ?? null,
    recommendationBuy: (reco.strongBuy ?? 0) + (reco.buy ?? 0),
    recommendationHold: reco.hold ?? 0,
    recommendationSell: (reco.sell ?? 0) + (reco.strongSell ?? 0),
    epsTrend: parseEarningsTrend(result),
  };
}
