/**
 * Unified AI service — supports Gemini, Groq, and Claude.
 * runAIPrompt tries every configured provider in priority order
 * (Gemini → Groq → Claude) and falls through on failure, so a deprecated
 * model or rate limit on one provider no longer breaks AI features.
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
  gemini: 'Gemini Flash',
  groq: 'Llama 3.3 70B (Groq)',
  claude: 'Claude Haiku',
};

export interface AIPromptOptions {
  maxTokens?: number;
  temperature?: number;
}

/** HTTP error carrying the provider's status + message so callers can classify it */
export class AIHttpError extends Error {
  constructor(public status: number, public providerMessage: string) {
    super(
      status === 401 ? 'Invalid API key. Check your key in Settings.'
      : status === 429 ? 'Rate limit reached. Try again in a moment.'
      : `AI request failed (${status})${providerMessage ? `: ${providerMessage}` : ''}`
    );
    this.name = 'AIHttpError';
  }
}

// ─── HTTP helper (native vs web) ─────────────────────────────────────────────

function extractProviderMessage(body: unknown): string {
  // Gemini/Groq: { error: { message } } — Anthropic: { error: { message } } too
  return (body as any)?.error?.message ?? '';
}

async function httpPost(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const res = await CapacitorHttp.post({ url, headers: { 'Content-Type': 'application/json', ...headers }, data: body });
    if (res.status < 200 || res.status >= 300) {
      throw new AIHttpError(res.status, extractProviderMessage(res.data));
    }
    return res.data;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new AIHttpError(res.status, extractProviderMessage(errBody));
  }
  return res.json();
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

// Newest first; older names fall through when Google retires them (404/400)
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

async function callGemini(prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const key = localStorage.getItem('TRADEEDGE_GEMINI_KEY')!;
  let lastErr: unknown;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const data: any = await httpPost(url, {}, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      });

      if (data?.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked the request (${data.promptFeedback.blockReason})`);
      }
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        const reason = candidate?.finishReason;
        throw new Error(reason && reason !== 'STOP' ? `Gemini stopped early (${reason})` : 'Empty response from Gemini');
      }
      return text;
    } catch (e) {
      lastErr = e;
      const modelGone =
        e instanceof AIHttpError &&
        (e.status === 404 ||
          (e.status === 400 && /not found|not supported|invalid model|deprecated/i.test(e.providerMessage)));
      if (!modelGone) throw e; // real failure — let the provider chain handle it
      // else: try the next model name
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Gemini models unavailable');
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const key = localStorage.getItem('TRADEEDGE_GROQ_KEY')!;
  const data = await httpPost(
    'https://api.groq.com/openai/v1/chat/completions',
    { Authorization: `Bearer ${key}` },
    {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    }
  );
  const text = (data as any)?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

// ─── Claude ───────────────────────────────────────────────────────────────────

async function callClaude(prompt: string, maxTokens: number, _temperature: number): Promise<string> {
  const key = localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY')!;
  const data = await httpPost(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }
  );
  const text = (data as any)?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');
  return text;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const CALLERS: Record<Exclude<AIProvider, null>, (p: string, m: number, t: number) => Promise<string>> = {
  gemini: callGemini,
  groq: callGroq,
  claude: callClaude,
};

function configuredProviders(): Exclude<AIProvider, null>[] {
  const out: Exclude<AIProvider, null>[] = [];
  if (localStorage.getItem('TRADEEDGE_GEMINI_KEY')) out.push('gemini');
  if (localStorage.getItem('TRADEEDGE_GROQ_KEY')) out.push('groq');
  if (localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY')) out.push('claude');
  return out;
}

/** Run a prompt through every configured provider until one succeeds. */
export async function runAIPromptWithMeta(
  prompt: string,
  opts: AIPromptOptions = {}
): Promise<{ text: string; provider: Exclude<AIProvider, null> }> {
  const providers = configuredProviders();
  if (!providers.length) {
    throw new Error('No AI provider configured. Add a Gemini, Groq, or Anthropic key in Settings.');
  }
  const maxTokens = opts.maxTokens ?? 700;
  const temperature = opts.temperature ?? 0.7;
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const text = await CALLERS[provider](prompt, maxTokens, temperature);
      return { text, provider };
    } catch (e) {
      errors.push(`${PROVIDER_LABELS[provider]}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }
  throw new Error(`All AI providers failed — ${errors.join(' | ')}`);
}

export async function runAIPrompt(prompt: string, opts?: AIPromptOptions): Promise<string> {
  return (await runAIPromptWithMeta(prompt, opts)).text;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

export interface MorningBriefDigest {
  dateLabel: string;
  marketOpen: boolean;
  futures: Array<{ label: string; changePercent: number }>;
  indices: Array<{ label: string; changePercent: number }>;
  yields: Array<{ label: string; value: number }>;
  commodities: Array<{ label: string; price: number; changePercent: number }>;
  crypto: Array<{ label: string; price: number; changePercent: number }>;
  fearGreed: { value: number; valueText: string } | null;
  topSectors: Array<{ name: string; changePercent: number }>;
  gainers: Array<{ symbol: string; changePercent: number }>;
  losers: Array<{ symbol: string; changePercent: number }>;
  earnings: { count: number; notable: string[] };
  headlines: string[];
}

export function buildMorningBriefPrompt(d: MorningBriefDigest): string {
  const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const lines: string[] = [];

  if (d.futures.length) lines.push(`Futures: ${d.futures.map((f) => `${f.label} ${pct(f.changePercent)}`).join(', ')}`);
  if (d.indices.length) lines.push(`Index ETFs: ${d.indices.map((i) => `${i.label} ${pct(i.changePercent)}`).join(', ')}`);
  if (d.yields.length) lines.push(`Treasury yields: ${d.yields.map((y) => `${y.label} ${y.value.toFixed(2)}%`).join(', ')}`);
  if (d.commodities.length) lines.push(`Commodities: ${d.commodities.map((c) => `${c.label} $${c.price.toFixed(2)} (${pct(c.changePercent)})`).join(', ')}`);
  if (d.crypto.length) lines.push(`Crypto: ${d.crypto.map((c) => `${c.label} $${c.price.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${pct(c.changePercent)})`).join(', ')}`);
  if (d.fearGreed) lines.push(`Fear & Greed Index: ${d.fearGreed.value} (${d.fearGreed.valueText})`);
  if (d.topSectors.length) lines.push(`Sector leaders/laggards: ${d.topSectors.map((s) => `${s.name} ${pct(s.changePercent)}`).join(', ')}`);
  if (d.gainers.length) lines.push(`Top gainers: ${d.gainers.map((g) => `${g.symbol} ${pct(g.changePercent)}`).join(', ')}`);
  if (d.losers.length) lines.push(`Top losers: ${d.losers.map((l) => `${l.symbol} ${pct(l.changePercent)}`).join(', ')}`);
  if (d.earnings.count > 0) lines.push(`Earnings today: ${d.earnings.count} companies reporting${d.earnings.notable.length ? `; notable: ${d.earnings.notable.join(', ')}` : ''}`);
  if (d.headlines.length) lines.push(`Headlines:\n${d.headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`);

  return `You are a professional sell-side market strategist writing a client-facing morning brief for ${d.dateLabel}. US markets are currently ${d.marketOpen ? 'open' : 'closed'}.

Write a 3-4 paragraph narrative in plain text organized under exactly these three headings, each on its own line:
Overnight & Futures
Macro & Rates
What to Watch Today

Rules: no JSON, no markdown symbols (#, *, -), no bullet lists — flowing prose only. Be specific: cite the actual numbers provided. Be direct and analytical. No generic disclaimers. Never invent data — reference only the data below.

MARKET DATA
${lines.join('\n')}

Write the brief:`;
}

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
