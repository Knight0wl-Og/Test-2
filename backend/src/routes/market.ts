import { Router, Request, Response } from 'express';
import axios from 'axios';
import { cached } from '../cache/redis';
import { getBatchQuotes, isMarketOpen } from '../services/yahooFinance';

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
      // Alternative.me CNN Fear & Greed API (free)
      const r = await axios.get('https://fear-and-greed-index.p.rapidapi.com/v1/fgi', {
        headers: {
          'x-rapidapi-host': 'fear-and-greed-index.p.rapidapi.com',
        },
        timeout: 5000,
      });
      return r.data;
    });
    res.json(data);
  } catch {
    // Fallback: return a mock if API is unavailable
    res.json({
      fgi: {
        now: { value: 50, valueText: 'Neutral' },
        previousClose: { value: 48, valueText: 'Neutral' },
        oneWeekAgo: { value: 55, valueText: 'Greed' },
        oneMonthAgo: { value: 40, valueText: 'Fear' },
      },
      _fallback: true,
    });
  }
});

export default router;
