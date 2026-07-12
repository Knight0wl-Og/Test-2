import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchHistory } from '../services/api';
import { computeTechnicalSnapshot } from '../utils/indicators';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import clsx from 'clsx';

function RsiGauge({ rsi }: { rsi: number }) {
  const pct = Math.min(Math.max(rsi, 0), 100);
  const zone = rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral';
  const color = rsi < 30 ? 'text-green' : rsi > 70 ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="bg-bg-card border border-border-dim rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white">RSI (14)</p>
        <div className="text-right">
          <span className="text-lg font-bold text-white font-mono">{rsi.toFixed(1)}</span>
          <span className={clsx('ml-2 text-xs font-semibold', color)}>{zone}</span>
        </div>
      </div>
      {/* Track */}
      <div className="relative h-3 rounded-full overflow-hidden" style={{
        background: 'linear-gradient(to right, #22c55e 0%, #22c55e 30%, #fbbf24 30%, #fbbf24 70%, #f87171 70%, #f87171 100%)',
      }}>
        <div
          className="absolute top-0 w-2.5 h-3 bg-white rounded-full shadow -translate-x-1/2 transition-all"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-green">Oversold &lt;30</span>
        <span className="text-[9px] text-text-muted">Neutral</span>
        <span className="text-[9px] text-red-400">Overbought &gt;70</span>
      </div>
    </div>
  );
}

function SignalBadge({ label, value, signal }: { label: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }) {
  return (
    <div className={clsx(
      'flex items-center justify-between bg-bg-card border rounded-lg px-3 py-2',
      signal === 'bullish' ? 'border-green/30' : signal === 'bearish' ? 'border-red-400/30' : 'border-border-dim'
    )}>
      <div>
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] text-text-muted font-mono mt-0.5">{value}</p>
      </div>
      <span className={clsx(
        'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded',
        signal === 'bullish' ? 'text-green bg-green/10' : signal === 'bearish' ? 'text-red-400 bg-red-400/10' : 'text-text-muted bg-bg-hover'
      )}>
        {signal}
      </span>
    </div>
  );
}

export function Technicals() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(storeSymbol ?? 'AAPL');
  const [symbol, setSymbol] = useState(storeSymbol ?? 'AAPL');

  // Indicators are computed locally from 2 years of daily history —
  // no API key needed (data comes from Yahoo/Schwab like the charts).
  const { data: bars, isLoading, error, refetch } = useQuery({
    queryKey: ['tech-history', symbol],
    queryFn: () => fetchHistory(symbol, '2y', '1d'),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  });

  const snap = useMemo(() => (bars ? computeTechnicalSnapshot(bars) : null), [bars]);

  const rsi = snap?.rsi14;
  const price = snap?.price;
  const ema20 = snap?.ema20;
  const ema50 = snap?.ema50;
  const ema200 = snap?.ema200;
  const macdVal = snap?.macd.macd;
  const signalVal = snap?.macd.signal;
  const histogramVal = snap?.macd.histogram;

  // Signals
  const priceVsEma20: 'bullish' | 'bearish' | 'neutral' = price && ema20 ? price > ema20 ? 'bullish' : 'bearish' : 'neutral';
  const priceVsEma50: 'bullish' | 'bearish' | 'neutral' = price && ema50 ? price > ema50 ? 'bullish' : 'bearish' : 'neutral';
  const priceVsEma200: 'bullish' | 'bearish' | 'neutral' = price && ema200 ? price > ema200 ? 'bullish' : 'bearish' : 'neutral';
  const macdSignal: 'bullish' | 'bearish' | 'neutral' = macdVal && signalVal ? macdVal > signalVal ? 'bullish' : 'bearish' : 'neutral';

  // Overall consensus
  const signals = [priceVsEma20, priceVsEma50, priceVsEma200, macdSignal];
  const bullCount = signals.filter((s) => s === 'bullish').length;
  const bearCount = signals.filter((s) => s === 'bearish').length;
  const consensus = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';
  const consensusColor = consensus === 'BULLISH' ? 'text-green' : consensus === 'BEARISH' ? 'text-red-400' : 'text-amber-400';

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-pink-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Technicals</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setSymbol(input.trim().toUpperCase()); }}
        className="flex gap-2 mb-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="Symbol"
          className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          Analyse
        </button>
      </form>

      {isLoading && <LoadingState rows={5} />}

      {error != null && (
        <ErrorState
          title="Failed to load price history"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && !snap && (
        <EmptyState
          icon={Activity}
          title="Not enough price history"
          message={`Need at least 30 daily bars to compute indicators for ${symbol}`}
        />
      )}

      {!isLoading && snap && rsi != null && (
        <>
          {/* Consensus */}
          <div className="bg-bg-card border border-border-dim rounded-xl p-4 mb-4 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Overall Signal</p>
            <p className={clsx('text-2xl font-bold', consensusColor)}>{consensus}</p>
            <p className="text-[10px] text-text-muted mt-1">{bullCount} bullish · {bearCount} bearish · {4 - bullCount - bearCount} neutral</p>
          </div>

          {/* RSI gauge */}
          <RsiGauge rsi={rsi} />

          {/* Moving averages */}
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">Moving Averages</p>
          <div className="space-y-2 mb-4">
            <SignalBadge
              label="EMA 20"
              value={ema20 != null ? `$${ema20.toFixed(2)} vs $${price?.toFixed(2)}` : '—'}
              signal={priceVsEma20}
            />
            <SignalBadge
              label="EMA 50"
              value={ema50 != null ? `$${ema50.toFixed(2)} vs $${price?.toFixed(2)}` : '—'}
              signal={priceVsEma50}
            />
            <SignalBadge
              label="EMA 200"
              value={ema200 != null ? `$${ema200.toFixed(2)} vs $${price?.toFixed(2)}` : '—'}
              signal={priceVsEma200}
            />
          </div>

          {/* MACD */}
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">MACD</p>
          <SignalBadge
            label="MACD vs Signal"
            value={macdVal != null ? `MACD ${macdVal.toFixed(3)} · Signal ${signalVal?.toFixed(3) ?? '—'} · Hist ${histogramVal?.toFixed(3) ?? '—'}` : '—'}
            signal={macdSignal}
          />
        </>
      )}
    </div>
  );
}
