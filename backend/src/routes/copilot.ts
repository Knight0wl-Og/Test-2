import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

interface MarketSnapshot {
  fearGreed: { value: number; valueText: string };
  vix: number | null;
  topGainers: Array<{ symbol: string; changePercent: number }>;
  topLosers: Array<{ symbol: string; changePercent: number }>;
  sectors: Array<{ name: string; changePercent: number }>;
}

// POST /api/copilot/analyse
router.post('/analyse', async (req: Request, res: Response) => {
  const apiKey: string | undefined =
    (req.headers['x-anthropic-key'] as string | undefined) ||
    process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    res.status(400).json({ error: 'No Anthropic API key provided. Add it in Settings.' });
    return;
  }

  const snapshot: MarketSnapshot = req.body;

  const gainers = snapshot.topGainers
    ?.slice(0, 5)
    .map((g) => `${g.symbol} +${g.changePercent.toFixed(2)}%`)
    .join(', ') || 'N/A';

  const losers = snapshot.topLosers
    ?.slice(0, 5)
    .map((l) => `${l.symbol} ${l.changePercent.toFixed(2)}%`)
    .join(', ') || 'N/A';

  const sectorSummary = snapshot.sectors
    ?.slice(0, 6)
    .map((s) => `${s.name}: ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`)
    .join(', ') || 'N/A';

  const prompt = `You are a concise market analyst. Analyse the following current market data and provide a brief, insightful summary (3-4 paragraphs) covering market sentiment, key movers, sector rotation, and any notable observations. Be direct and avoid generic disclaimers.

Market Data:
- Fear & Greed Index: ${snapshot.fearGreed?.value ?? 'N/A'} (${snapshot.fearGreed?.valueText ?? 'N/A'})
- VIX: ${snapshot.vix?.toFixed(2) ?? 'N/A'}
- Top Gainers: ${gainers}
- Top Losers: ${losers}
- Sector Performance: ${sectorSummary}

Write a concise market analysis:`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      }
    );

    const text: string = response.data?.content?.[0]?.text ?? '';
    res.json({ analysis: text });
  } catch (err: unknown) {
    const axErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
    if (axErr.response?.status === 401) {
      res.status(401).json({ error: 'Invalid Anthropic API key. Check your key in Settings.' });
    } else if (axErr.response?.status === 429) {
      res.status(429).json({ error: 'Anthropic rate limit reached. Try again in a moment.' });
    } else {
      const msg = axErr.response?.data?.error?.message ?? 'Failed to generate analysis.';
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
