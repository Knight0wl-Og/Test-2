import { Router, Request, Response } from 'express';
import { cached } from '../cache/redis';
import { getQuote, getBatchQuotes, getHistory } from '../services/yahooFinance';

const router = Router();

// GET /api/quotes/batch?symbols=AAPL,MSFT,NVDA
router.get('/batch', async (req: Request, res: Response) => {
  const raw = req.query.symbols as string;
  if (!raw) return res.status(400).json({ error: 'symbols query param required' });

  const symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 50);
  const cacheKey = `quotes:batch:${symbols.sort().join(',')}`;

  try {
    const data = await cached(cacheKey, 60, () => getBatchQuotes(symbols));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/:symbol/history?period=3mo&interval=1d
router.get('/:symbol/history', async (req: Request, res: Response) => {
  const symbol = req.params.symbol.toUpperCase();
  const period = (req.query.period as string) || '3mo';
  const interval = (req.query.interval as string) || '1d';
  const cacheKey = `history:${symbol}:${period}:${interval}`;

  try {
    const data = await cached(cacheKey, 300, () => getHistory(symbol, period, interval));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotes/:symbol
router.get('/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params.symbol.toUpperCase();
  const cacheKey = `quote:${symbol}`;

  try {
    const data = await cached(cacheKey, 60, () => getQuote(symbol));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
