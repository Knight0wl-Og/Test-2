import { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, AlertCircle, Key, Send, Trash2, TrendingUp, BarChart2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchFearGreed, fetchBatchQuotes, fetchSectors } from '../services/api';
import {
  runAIPrompt, getActiveProvider, PROVIDER_LABELS,
  buildMarketPrompt, buildSymbolPrompt,
} from '../services/aiService';
import { useWatchlistStore } from '../store/watchlistStore';
import { useQuote } from '../hooks/useQuotes';
import { useAnalystRatings } from '../hooks/useAnalystRatings';
import { useEarnings } from '../hooks/useEarnings';
import { useInstitutional } from '../hooks/useInstitutional';
import type { FearGreedData, Quote, SectorData } from '../types';
import clsx from 'clsx';

const MOVERS_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','JPM',
  'GS','V','MA','UNH','LLY','XOM','CVX','SPY','QQQ','IWM',
];

const STORAGE_KEY = 'tradeedge_chat_history';
const MAX_MESSAGES = 40;

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
  ts: string;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_MESSAGES)));
  } catch { /* storage full — ignore */ }
}

function ProviderBadge() {
  const provider = getActiveProvider();
  if (!provider) return null;
  const colors: Record<string, string> = {
    gemini: 'text-blue-400 bg-blue-400/10',
    groq: 'text-orange-400 bg-orange-400/10',
    claude: 'text-purple-400 bg-purple-400/10',
  };
  return (
    <span className={clsx('text-[10px] px-2 py-0.5 rounded font-medium', colors[provider])}>
      {PROVIDER_LABELS[provider]}
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] bg-accent/20 border border-accent/30 rounded-2xl rounded-tr-sm px-3 py-2">
          <p className="text-xs text-white leading-relaxed">{msg.content}</p>
          <p className="text-[9px] text-accent/60 mt-1 text-right">{msg.ts}</p>
        </div>
      </div>
    );
  }
  if (msg.role === 'error') {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[85%] bg-red-950/40 border border-red-900/40 rounded-2xl rounded-tl-sm px-3 py-2 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400 leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] bg-bg-card border border-border-dim rounded-2xl rounded-tl-sm px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Bot className="w-3 h-3 text-accent" />
          <span className="text-[9px] text-text-muted">{msg.ts}</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        <p className="text-[9px] text-text-muted/50 mt-1.5 pt-1 border-t border-border-dim/50">
          For informational purposes only · Not financial advice
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AICopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const provider = getActiveProvider();
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const activeSymbol = (selectedSymbol || 'AAPL').toUpperCase();

  const { data: fgData } = useQuery<FearGreedData>({ queryKey: ['fear-greed'], queryFn: fetchFearGreed, staleTime: 300_000 });
  const { data: quotes = [] } = useQuery<Quote[]>({ queryKey: ['quotes', MOVERS_UNIVERSE.join(',')], queryFn: () => fetchBatchQuotes(MOVERS_UNIVERSE), staleTime: 60_000 });
  const { data: sectors = [] } = useQuery<SectorData[]>({ queryKey: ['sectors'], queryFn: fetchSectors, staleTime: 300_000 });
  const { data: quote } = useQuote(activeSymbol);
  const { data: ratings } = useAnalystRatings(activeSymbol);
  const { data: earnings } = useEarnings(activeSymbol);
  const { data: institutional } = useInstitutional(activeSymbol);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Persist history whenever it changes
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  function nowTs() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function addMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  async function send(prompt: string, userLabel: string) {
    if (!provider || loading) return;
    addMessage({ role: 'user', content: userLabel, ts: nowTs() });
    setLoading(true);
    try {
      const reply = await runAIPrompt(prompt);
      addMessage({ role: 'assistant', content: reply, ts: nowTs() });
    } catch (e: unknown) {
      addMessage({ role: 'error', content: (e as Error).message ?? 'Analysis failed', ts: nowTs() });
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !provider || loading) return;
    setInput('');
    await send(text, text);
  }

  async function handleMarket() {
    const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
    const prompt = buildMarketPrompt({
      fearGreed: fgData?.fgi?.now ?? { value: 50, valueText: 'Neutral' },
      vix: quotes.find((q) => q.symbol === '^VIX')?.price ?? null,
      topGainers: sorted.slice(0, 5).map((q) => ({ symbol: q.symbol, changePercent: q.changePercent })),
      topLosers: sorted.slice(-5).reverse().map((q) => ({ symbol: q.symbol, changePercent: q.changePercent })),
      sectors: sectors.map((s) => ({ name: s.name, changePercent: s.changePercent })),
    });
    await send(prompt, 'Give me a market overview');
  }

  async function handleSymbol() {
    if (!quote) return;
    const today = new Date().toISOString().slice(0, 10);
    const nextEarnings = earnings?.find((e) => e.date >= today);
    const lastEarnings = earnings?.filter((e) => e.date < today).at(-1);
    const latest = ratings?.[0];
    const totalRatings = latest ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell : 0;
    const consensus = (() => {
      if (!latest || totalRatings === 0) return null;
      const score = (latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell * 1) / totalRatings;
      if (score >= 4.5) return 'Strong Buy';
      if (score >= 3.5) return 'Buy';
      if (score >= 2.5) return 'Hold';
      if (score >= 1.5) return 'Sell';
      return 'Strong Sell';
    })();
    const prompt = buildSymbolPrompt({
      symbol: activeSymbol,
      price: quote.price,
      changePercent: quote.changePercent,
      change: quote.change,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      previousClose: quote.previousClose,
      volume: quote.volume,
      marketCap: quote.marketCap,
      pe: quote.pe,
      analystConsensus: consensus ?? undefined,
      analystCount: totalRatings || undefined,
      nextEarnings: nextEarnings?.date,
      lastEarningsSurprise: lastEarnings?.surprise ?? undefined,
      institutionPct: institutional?.institutionPct,
      insiderPct: institutional?.insiderPct,
    });
    await send(prompt, `Analyse ${activeSymbol} for me`);
  }

  function clearChat() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-panel bg-bg-secondary shrink-0">
        <Bot className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-white">AI Copilot</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">Beta</span>
        <ProviderBadge />
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="ml-auto p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── No key warning ── */}
      {!provider && (
        <div className="mx-4 mt-3 bg-bg-card border border-yellow-900/40 rounded-lg p-3 flex gap-2 shrink-0">
          <Key className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400 leading-relaxed">
            Add a free <strong>Gemini</strong> or <strong>Groq</strong> key in Settings to enable AI chat.
          </p>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot className="w-10 h-10 text-text-muted/30" />
            <p className="text-sm text-text-muted">Ask anything about the market</p>
            <p className="text-xs text-text-muted/60">Use the quick buttons below or type your own question</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-bg-card border border-border-dim rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick actions ── */}
      <div className="flex gap-2 px-4 py-2 border-t border-panel shrink-0">
        <button
          onClick={handleMarket}
          disabled={loading || !provider}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card border border-border-dim text-xs text-text-muted hover:text-white hover:border-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <BarChart2 className="w-3 h-3" /> Market
        </button>
        <button
          onClick={handleSymbol}
          disabled={loading || !provider || !quote}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card border border-border-dim text-xs text-text-muted hover:text-white hover:border-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <TrendingUp className="w-3 h-3" /> {activeSymbol}
        </button>
      </div>

      {/* ── Input ── */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={provider ? 'Ask a question…' : 'Add an AI key in Settings first'}
          disabled={!provider || loading}
          className="flex-1 bg-bg-hover border border-border-dim rounded-full px-4 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !provider || loading}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send className="w-3.5 h-3.5 text-white" />
        </button>
      </div>

    </div>
  );
}
