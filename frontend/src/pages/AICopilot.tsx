import { useState } from 'react';
import { Bot, Sparkles, AlertCircle, Key } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchFearGreed, fetchBatchQuotes, fetchSectors, fetchCopilotAnalysis } from '../services/api';
import type { FearGreedData, Quote, SectorData } from '../types';

const MOVERS_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','AVGO','JPM',
  'GS','V','MA','UNH','LLY','XOM','CVX','SPY','QQQ','IWM',
];

function ApiKeyNote() {
  return (
    <div className="bg-bg-card border border-yellow-900/40 rounded-lg p-4 flex gap-3">
      <Key className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-xs font-medium text-yellow-400">Anthropic API Key Required</p>
        <p className="text-xs text-text-muted leading-relaxed">
          The AI Copilot uses Claude to analyse market data. Add your Anthropic API key in{' '}
          <strong className="text-gray-300">Settings</strong> (top-right gear icon) to enable this feature.
          Your key is stored locally and never shared.
        </p>
      </div>
    </div>
  );
}

export function AICopilot() {
  const [analysis, setAnalysis] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [hasKey] = useState(() => !!localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY'));

  const { data: fgData } = useQuery<FearGreedData>({
    queryKey: ['fear-greed'],
    queryFn: fetchFearGreed,
    staleTime: 300_000,
  });

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ['quotes', MOVERS_UNIVERSE.join(',')],
    queryFn: () => fetchBatchQuotes(MOVERS_UNIVERSE),
    staleTime: 60_000,
  });

  const { data: sectors = [] } = useQuery<SectorData[]>({
    queryKey: ['sectors'],
    queryFn: fetchSectors,
    staleTime: 300_000,
  });

  async function handleAnalyse() {
    setIsAnalysing(true);
    setError('');
    setAnalysis('');

    try {
      const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
      const vixQuote = quotes.find((q) => q.symbol === '^VIX');

      const snapshot = {
        fearGreed: fgData?.fgi?.now ?? { value: 50, valueText: 'Neutral' },
        vix: vixQuote?.price ?? null,
        topGainers: sorted.slice(0, 5).map((q) => ({ symbol: q.symbol, changePercent: q.changePercent })),
        topLosers: sorted.slice(-5).reverse().map((q) => ({ symbol: q.symbol, changePercent: q.changePercent })),
        sectors: sectors.map((s) => ({ name: s.name, changePercent: s.changePercent })),
      };

      const result = await fetchCopilotAnalysis(snapshot);
      setAnalysis(result);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? 'Failed to generate analysis. Please try again.');
    } finally {
      setIsAnalysing(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-accent" />
        <h1 className="text-sm font-semibold text-white">AI Copilot</h1>
        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent ml-1">Beta</span>
      </div>

      {!hasKey && <ApiKeyNote />}

      {/* Context cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-bg-card border border-border-dim rounded-lg p-3">
          <p className="text-xs text-text-muted mb-0.5">Fear & Greed</p>
          <p className="text-sm font-bold text-white">{fgData?.fgi?.now?.value ?? '—'}</p>
          <p className="text-xs text-text-muted">{fgData?.fgi?.now?.valueText ?? '—'}</p>
        </div>
        <div className="bg-bg-card border border-border-dim rounded-lg p-3">
          <p className="text-xs text-text-muted mb-0.5">VIX</p>
          <p className="text-sm font-bold text-white">
            {quotes.find((q) => q.symbol === '^VIX')?.price?.toFixed(2) ?? '—'}
          </p>
          <p className="text-xs text-text-muted">Volatility Index</p>
        </div>
        <div className="bg-bg-card border border-border-dim rounded-lg p-3">
          <p className="text-xs text-text-muted mb-0.5">Symbols</p>
          <p className="text-sm font-bold text-white">{MOVERS_UNIVERSE.length}</p>
          <p className="text-xs text-text-muted">Tracked</p>
        </div>
        <div className="bg-bg-card border border-border-dim rounded-lg p-3">
          <p className="text-xs text-text-muted mb-0.5">Sectors</p>
          <p className="text-sm font-bold text-white">{sectors.length}</p>
          <p className="text-xs text-text-muted">Monitored</p>
        </div>
      </div>

      {/* Analyse button */}
      <button
        onClick={handleAnalyse}
        disabled={isAnalysing}
        className="flex items-center justify-center gap-2 w-full sm:w-auto sm:px-6 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
      >
        {isAnalysing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analysing market…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Analyse Market Now
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-bg-card border border-red-900/40 rounded-lg p-4 flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Analysis output */}
      {analysis && (
        <div className="bg-bg-card border border-border-dim rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-white">Market Analysis</span>
            <span className="text-xs text-text-muted ml-auto">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
            {analysis}
          </div>
          <p className="text-[10px] text-text-muted/60 pt-1 border-t border-border-dim">
            Generated by Claude · For informational purposes only. Not financial advice.
          </p>
        </div>
      )}

      {!analysis && !error && !isAnalysing && (
        <div className="bg-bg-card border border-border-dim rounded-lg p-8 text-center space-y-2">
          <Bot className="w-8 h-8 text-text-muted/40 mx-auto" />
          <p className="text-sm text-text-muted">Click "Analyse Market Now" to generate an AI market summary</p>
          <p className="text-xs text-text-muted/60">Uses live Fear &amp; Greed, VIX, movers, and sector data</p>
        </div>
      )}
    </div>
  );
}
