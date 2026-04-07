/**
 * Unified AI service — supports Gemini, Groq, and Claude.
 * Priority: Gemini → Groq → Claude (first key found is used, or preferred if both set).
 */
import { Capacitor } from '@capacitor/core';

export type AIProvider = 'gemini' | 'groq' | 'claude' | null;

export function getActiveProvider(): AIProvider {
  if (localStorage.getItem('TRADEEDGE_GEMINI_KEY')) return 'gemini';
  if (localStorage.getItem('TRADEEDGE_GROQ_KEY')) return 'groq';
  if (localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY')) return 'claude';
  return null;
}

export const PROVIDER_LABELS: Record<Exclude<AIProvider, null>, string> = {
  gemini: 'Gemini 2.0 Flash',
  groq: 'Llama 3.3 70B (Groq)',
  claude: 'Claude Haiku',
};

// ─── HTTP helper (native vs web) ─────────────────────────────────────────────

async function httpPost(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const res = await CapacitorHttp.post({ url, headers, data: body });
    if (res.status === 401) throw new Error('Invalid API key. Check your key in Settings.');
    if (res.status === 429) throw new Error('Rate limit reached. Try again in a moment.');
    if (res.status < 200 || res.status >= 300) throw new Error(`AI request failed (${res.status})`);
    return res.data;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('Invalid API key. Check your key in Settings.');
  if (res.status === 429) throw new Error('Rate limit reached. Try again in a moment.');
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  return res.json();
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const key = localStorage.getItem('TRADEEDGE_GEMINI_KEY')!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const data = await httpPost(url, {}, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
  });
  const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const key = localStorage.getItem('TRADEEDGE_GROQ_KEY')!;
  const data = await httpPost(
    'https://api.groq.com/openai/v1/chat/completions',
    { Authorization: `Bearer ${key}` },
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
      temperature: 0.7,
    }
  );
  const text = (data as any)?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

// ─── Claude ───────────────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<string> {
  const key = localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY')!;
  const data = await httpPost(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }
  );
  const text = (data as any)?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');
  return text;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runAIPrompt(prompt: string): Promise<string> {
  const provider = getActiveProvider();
  if (!provider) throw new Error('No AI provider configured. Add a Gemini, Groq, or Anthropic key in Settings.');
  if (provider === 'gemini') return callGemini(prompt);
  if (provider === 'groq') return callGroq(prompt);
  return callClaude(prompt);
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

export function buildMarketPrompt(snapshot: {
  fearGreed: { value: number; valueText: string };
  vix: number | null;
  topGainers: Array<{ symbol: string; changePercent: number }>;
  topLosers: Array<{ symbol: string; changePercent: number }>;
  sectors: Array<{ name: string; changePercent: number }>;
}): string {
  const gainers = snapshot.topGainers.map((g) => `${g.symbol} +${g.changePercent.toFixed(2)}%`).join(', ');
  const losers = snapshot.topLosers.map((l) => `${l.symbol} ${l.changePercent.toFixed(2)}%`).join(', ');
  const sects = snapshot.sectors.map((s) => `${s.name}: ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`).join(', ');

  return `You are a concise, professional market analyst. Analyse the following live market data and write a brief, insightful summary (3–4 short paragraphs) covering: market sentiment, key movers, sector rotation, and any notable observations. Be direct — no generic disclaimers.

Market Data:
- Fear & Greed Index: ${snapshot.fearGreed.value} (${snapshot.fearGreed.valueText})
- VIX: ${snapshot.vix?.toFixed(2) ?? 'N/A'}
- Top Gainers: ${gainers}
- Top Losers: ${losers}
- Sector Performance: ${sects}

Write the analysis:`;
}

export function buildSymbolPrompt(data: {
  symbol: string;
  price: number;
  changePercent: number;
  change: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number | null;
  pe: number | null;
  analystConsensus?: string;
  analystCount?: number;
  nextEarnings?: string;
  lastEarningsSurprise?: number;
  institutionPct?: number;
  insiderPct?: number;
  putCallRatio?: number | null;
}): string {
  const lines = [
    `Symbol: ${data.symbol}`,
    `Price: $${data.price.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}% today, ${data.changePercent >= 0 ? '+' : ''}$${data.change.toFixed(2)})`,
    `OHLC: O ${data.open.toFixed(2)} / H ${data.high.toFixed(2)} / L ${data.low.toFixed(2)} / PC ${data.previousClose.toFixed(2)}`,
    `Volume: ${(data.volume / 1e6).toFixed(2)}M`,
    data.marketCap ? `Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B` : null,
    data.pe ? `P/E Ratio: ${data.pe.toFixed(1)}` : null,
    data.analystConsensus ? `Analyst Consensus: ${data.analystConsensus} (${data.analystCount} analysts)` : null,
    data.nextEarnings ? `Next Earnings: ${data.nextEarnings}` : null,
    data.lastEarningsSurprise != null ? `Last EPS Surprise: ${data.lastEarningsSurprise >= 0 ? '+' : ''}${data.lastEarningsSurprise.toFixed(1)}%` : null,
    data.institutionPct != null ? `Institutional Ownership: ${data.institutionPct.toFixed(1)}%` : null,
    data.insiderPct != null ? `Insider Ownership: ${data.insiderPct.toFixed(1)}%` : null,
    data.putCallRatio != null ? `Put/Call Ratio: ${data.putCallRatio.toFixed(2)}` : null,
  ].filter(Boolean).join('\n');

  return `You are a concise, professional stock analyst. Based on the following data for ${data.symbol}, write a brief analysis (3–4 short paragraphs) covering: today's price action, key technical levels, fundamental snapshot, and a short bull/bear thesis. Be direct and specific to this stock. No generic disclaimers.

${lines}

Write the analysis:`;
}
