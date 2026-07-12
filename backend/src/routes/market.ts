import { Router, Request, Response } from 'express';
import axios from 'axios';
import { cached } from '../cache/redis';
import { getBatchQuotes, isMarketOpen } from '../services/yahooFinance';
import { getMockFearGreed } from '../services/mockData';

const router = Router();

const INDICES = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX', '^GSPC', '^IXIC', '^RUT'];

const SECTORS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLY', name: 'Consumer Disc.' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Comm. Services' },
];

// GET /api/market/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({ marketOpen: isMarketOpen() });
});

// GET /api/market/indices
router.get('/indices', async (_req: Request, res: Response) => {
  try {
    const data = await cached('market:indices', 60, () => getBatchQuotes(INDICES));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/sectors
router.get('/sectors', async (_req: Request, res: Response) => {
  try {
    const quotes = await cached('market:sectors', 300, () =>
      getBatchQuotes(SECTORS.map((s) => s.symbol))
    );

    const data = SECTORS.map((s) => {
      const q = quotes.find((q) => q.symbol === s.symbol);
      return { ...s, ...(q || { price: 0, changePercent: 0 }) };
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/fear-greed
router.get('/fear-greed', async (_req: Request, res: Response) => {
  try {
    const data = await cached('market:fear-greed', 3600, async () => {
      // Alternative.me Fear & Greed Index API (free)
      const r = await axios.get('https://api.alternative.me/fng/?limit=30', {
        timeout: 5000,
      });
      const entries: Array<{ value: string; value_classification: string }> = r.data.data;
      const pick = (i: number) => {
        const e = entries[Math.min(i, entries.length - 1)];
        return { value: Number(e.value), valueText: e.value_classification };
      };
      return {
        fgi: {
          now: pick(0),
          previousClose: pick(1),
          oneWeekAgo: pick(7),
          oneMonthAgo: pick(29),
        },
      };
    });
    res.json(data);
  } catch {
    res.json({ ...getMockFearGreed(), _fallback: true });
  }
});

// GET /api/market/earnings-week
router.get('/earnings-week', async (_req: Request, res: Response) => {
  try {
    const symbols = await cached('market:earnings-week', 21600, async () => {
      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);

      const dates = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toISOString().slice(0, 10);
      });

      const HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json, text/plain, */*',
      };

      function extractSymbol(raw: string): string {
        const anchor = raw.match(/>([A-Z.]{1,6})</);
        if (anchor) return anchor[1];
        const plain = raw.trim().toUpperCase();
        return /^[A-Z.]{1,6}$/.test(plain) ? plain : '';
      }

      const results = await Promise.allSettled(
        dates.map((date) =>
          axios
            .get(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
              headers: HEADERS,
              timeout: 8000,
            })
            .then((r) => {
              const rows: Array<{ symbol: string }> = r.data?.data?.rows ?? [];
              return rows.map((row) => extractSymbol(row.symbol)).filter(Boolean);
            })
        )
      );

      const all = new Set<string>();
      for (const r of results) {
        if (r.status === 'fulfilled') r.value.forEach((s: string) => all.add(s));
      }
      return Array.from(all).slice(0, 30);
    });
    res.json(symbols);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/screener?scrIds=day_gainers&count=25
// Proxy for Yahoo Finance predefined screeners (raw JSON passthrough —
// the frontend parses with parseScreenerQuotes so the mapping lives in one place)
const SCREENER_IDS = new Set(['day_gainers', 'day_losers', 'most_actives']);

router.get('/screener', async (req: Request, res: Response) => {
  const scrIds = String(req.query.scrIds ?? '');
  const count = Math.min(Math.max(Number(req.query.count) || 25, 1), 250);
  if (!SCREENER_IDS.has(scrIds)) {
    res.status(400).json({ error: `scrIds must be one of: ${Array.from(SCREENER_IDS).join(', ')}` });
    return;
  }
  try {
    const data = await cached(`market:screener:${scrIds}:${count}`, 60, async () => {
      const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${scrIds}&count=${count}&formatted=false`;
      const r = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        timeout: 10000,
      });
      return r.data;
    });
    res.json(data);
  } catch (err: any) {
    res.status(err.response?.status ?? 500).json({ error: err.message });
  }
});

// GET /api/market/research/:symbol
// NOTE: keep the response shape in sync with frontend/src/services/nativeResearch.ts
router.get('/research/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  try {
    // v2 cache key: shape extended with earningsTrend/targets/dividendYield in v4.0
    const data = await cached(`market:research:v2:${symbol}`, 300, async () => {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,financialData,recommendationTrend,assetProfile,defaultKeyStatistics,earningsTrend`;
      const r = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const result = r.data?.quoteSummary?.result?.[0];
      if (!result) throw new Error('No data');

      const profile = result.assetProfile ?? {};
      const financials = result.financialData ?? {};
      const keyStats = result.defaultKeyStatistics ?? {};
      const summary = result.summaryDetail ?? {};
      const reco = result.recommendationTrend?.trend?.[0] ?? {};

      const trend: any[] = result.earningsTrend?.trend ?? [];
      const byPeriod = (period: string) => {
        const entry = trend.find((t: any) => t.period === period);
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
        epsTrend: {
          currentQuarter: byPeriod('0q'),
          nextQuarter: byPeriod('+1q'),
          currentYear: byPeriod('0y'),
          nextYear: byPeriod('+1y'),
        },
      };
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/market/options/:symbol
router.get('/options/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const date = req.query.date ? Number(req.query.date) : undefined;
  try {
    let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
    if (date) url += `?date=${date}`;

    const r = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json',
      },
      timeout: 10000,
    });

    const result = r.data?.optionChain?.result?.[0];
    if (!result) {
      res.status(404).json({ error: 'No options data found' });
      return;
    }

    const expDateTs: number = result.options?.[0]?.expirationDate ?? 0;

    function mapContract(raw: any) {
      return {
        strike: raw.strike ?? 0,
        bid: raw.bid ?? 0,
        ask: raw.ask ?? 0,
        lastPrice: raw.lastPrice ?? 0,
        volume: raw.volume ?? null,
        openInterest: raw.openInterest ?? null,
        impliedVolatility: raw.impliedVolatility != null
          ? Number((raw.impliedVolatility * 100).toFixed(2)) : null,
        inTheMoney: raw.inTheMoney ?? false,
        expiration: new Date(expDateTs * 1000).toISOString().slice(0, 10),
        contractSymbol: raw.contractSymbol ?? '',
      };
    }

    res.json({
      symbol: symbol.toUpperCase(),
      expirationDates: (result.expirationDates ?? []).map(String),
      calls: (result.options?.[0]?.calls ?? []).map(mapContract),
      puts: (result.options?.[0]?.puts ?? []).map(mapContract),
      underlyingPrice: result.quote?.regularMarketPrice ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fmp/* — proxy Financial Modeling Prep requests
// Key is read from x-fmp-key header (sent by frontend) or FMP_KEY env var
router.get('/fmp/*', async (req: Request, res: Response) => {
  const fmpPath = (req.params as any)[0] as string;
  const apiKey = (req.headers['x-fmp-key'] as string) || process.env.FMP_KEY || '';
  if (!apiKey) {
    res.status(400).json({ error: 'FMP API key not configured' });
    return;
  }
  try {
    const query = new URLSearchParams({
      ...(req.query as Record<string, string>),
      apikey: apiKey,
    }).toString();
    const { data } = await axios.get(
      `https://financialmodelingprep.com/api/${fmpPath}?${query}`,
      { timeout: 12000 }
    );
    res.json(data);
  } catch (err: any) {
    // Forward the upstream status (401/403/429) so the frontend can detect
    // invalid-key and paid-plan conditions instead of seeing a generic 500.
    res.status(err.response?.status ?? 500).json({ error: err.message });
  }
});

export default router;

