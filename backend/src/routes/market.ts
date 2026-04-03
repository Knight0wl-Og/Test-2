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

export default router;
