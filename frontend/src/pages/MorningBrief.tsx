/**
 * Morning Brief — Fiorillo-style daily pre-market report.
 * Futures, indices, rates, commodities, crypto, fear & greed, sectors,
 * today's earnings, movers, headlines — topped by an AI-written narrative
 * generated from all of the data via the Gemini→Groq→Claude chain.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sunrise, RefreshCw, Sparkles, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import {
  fetchBatchQuotes, fetchMarketStatus, fetchFearGreed, fetchSectors, fetchScreener,
} from '../services/api';
import { fetchEarningsCalendarRange, hasFinnhubKey } from '../services/finnhubService';
import { fetchGeneralNewsFMP, getFmpKey } from '../services/fmpService';
import {
  runAIPromptWithMeta, buildMorningBriefPrompt, PROVIDER_LABELS,
  getActiveProvider, type MorningBriefDigest, type AIProvider,
} from '../services/aiService';
import { PageShell } from '../components/common/PageShell';
import { SectionLabel } from '../components/common/SectionLabel';
import { FearGreedGauge, getFearGreedColor } from '../components/dashboard/FearGreedWidget';
import { useWatchlistStore } from '../store/watchlistStore';
import type { Quote } from '../types';
import clsx from 'clsx';

// ─── Symbols ─────────────────────────────────────────────────────────────────

const BRIEF_SYMBOLS = [
  'ES=F', 'NQ=F', 'YM=F', 'RTY=F',
  'SPY', 'QQQ', 'DIA', 'IWM',
  '^TNX', '^TYX', '^FVX',
  'CL=F', 'GC=F', 'SI=F', 'DX-Y.NYB',
  'BTC-USD', 'ETH-USD',
];

const FUTURES: Array<[string, string]> = [['ES=F', 'S&P 500'], ['NQ=F', 'Nasdaq 100'], ['YM=F', 'Dow'], ['RTY=F', 'Russell 2000']];
const INDEX_ETFS: Array<[string, string]> = [['SPY', 'S&P 500'], ['QQQ', 'Nasdaq'], ['DIA', 'Dow'], ['IWM', 'Russell 2K']];
const YIELDS: Array<[string, string]> = [['^FVX', '5Y Yield'], ['^TNX', '10Y Yield'], ['^TYX', '30Y Yield']];
const COMMODITIES: Array<[string, string]> = [['CL=F', 'WTI Crude'], ['GC=F', 'Gold'], ['SI=F', 'Silver'], ['DX-Y.NYB', 'Dollar Index']];
const CRYPTO: Array<[string, string]> = [['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum']];

// ─── Cache ───────────────────────────────────────────────────────────────────

const BRIEF_CACHE_KEY = 'tradeedge_morning_brief_v3';

interface BriefCache {
  date: string;
  text: string;
  provider: Exclude<AIProvider, null>;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadBriefCache(): BriefCache | null {
  try {
    const raw = JSON.parse(localStorage.getItem(BRIEF_CACHE_KEY) || 'null') as BriefCache | null;
    return raw && raw.date === todayKey() && raw.text ? raw : null;
  } catch {
    return null;
  }
}

// ─── Small components ────────────────────────────────────────────────────────

function pctText(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function QuoteStat({ label, quote, format = 'price' }: {
  label: string;
  quote: Quote | undefined;
  format?: 'price' | 'yield' | 'big';
}) {
  const pct = quote?.changePercent ?? 0;
  const pos = pct >= 0;
  let value = '—';
  if (quote) {
    if (format === 'yield') value = `${quote.price.toFixed(2)}%`;
    else if (format === 'big') value = `$${quote.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    else value = `$${quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return (
    <div className="card-surface p-3">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className="text-sm font-bold text-white num leading-tight">{value}</p>
      <p className={clsx('text-[11px] font-semibold num', quote ? (pos ? 'text-green' : 'text-red-400') : 'text-text-muted')}>
        {quote ? pctText(pct) : ''}
      </p>
    </div>
  );
}

function MoverRow({ quote, onSelect }: { quote: Quote; onSelect: () => void }) {
  const pos = quote.changePercent >= 0;
  return (
    <button onClick={onSelect} className="w-full flex items-center justify-between px-3 py-2 hover:bg-bg-hover rounded-lg transition-colors text-left">
      <div className="min-w-0">
        <span className="text-xs font-bold text-white">{quote.symbol}</span>
        <span className="text-[10px] text-text-muted ml-2 truncate hidden sm:inline">{quote.shortName}</span>
      </div>
      <span className={clsx('text-xs font-semibold num shrink-0', pos ? 'text-green' : 'text-red-400')}>
        {pctText(quote.changePercent)}
      </span>
    </button>
  );
}

// ─── Narrative renderer ──────────────────────────────────────────────────────

const NARRATIVE_HEADINGS = new Set(['Overnight & Futures', 'Macro & Rates', 'What to Watch Today']);

function Narrative({ text }: { text: string }) {
  const blocks = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-2.5">
      {blocks.map((line, i) =>
        NARRATIVE_HEADINGS.has(line.replace(/[:.]$/, '')) ? (
          <p key={i} className="section-label !text-gold pt-1.5">{line.replace(/[:.]$/, '')}</p>
        ) : (
          <p key={i} className="text-[13px] text-gray-300 leading-relaxed">{line}</p>
        )
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function MorningBrief() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const today = todayKey();
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // ── Data queries ──
  const quotesQ = useQuery({
    queryKey: ['brief-quotes'],
    queryFn: () => fetchBatchQuotes(BRIEF_SYMBOLS),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const statusQ = useQuery({ queryKey: ['brief-status'], queryFn: fetchMarketStatus, staleTime: 60_000 });
  const fgQ = useQuery({ queryKey: ['brief-fg'], queryFn: fetchFearGreed, staleTime: 30 * 60_000 });
  const sectorsQ = useQuery({ queryKey: ['brief-sectors'], queryFn: fetchSectors, staleTime: 5 * 60_000 });
  const gainersQ = useQuery({ queryKey: ['brief-gainers'], queryFn: () => fetchScreener('day_gainers', 5), staleTime: 60_000 });
  const losersQ = useQuery({ queryKey: ['brief-losers'], queryFn: () => fetchScreener('day_losers', 5), staleTime: 60_000 });
  const earningsQ = useQuery({
    queryKey: ['brief-earnings', today],
    queryFn: () => fetchEarningsCalendarRange(today, today),
    enabled: hasFinnhubKey(),
    staleTime: 30 * 60_000,
  });
  const newsQ = useQuery({
    queryKey: ['brief-news'],
    queryFn: () => fetchGeneralNewsFMP(0),
    enabled: !!getFmpKey(),
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const q = (sym: string) => quotesQ.data?.find((x) => x.symbol === sym);

  // ── AI narrative state ──
  const [brief, setBrief] = useState<BriefCache | null>(() => loadBriefCache());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const hasAIKey = getActiveProvider() != null;

  const dataReady = !!quotesQ.data && !!fgQ.data && !gainersQ.isLoading && !losersQ.isLoading;

  const digest = useMemo((): MorningBriefDigest | null => {
    if (!quotesQ.data) return null;
    const mapQuotes = (pairs: Array<[string, string]>) =>
      pairs.map(([sym, label]) => ({ label, quote: q(sym) })).filter((x) => x.quote);
    const earnings = earningsQ.data ?? [];
    // Rank today's reporters by having an estimate (analyst coverage proxy)
    const notable = earnings.filter((e) => e.epsEstimate != null).slice(0, 8).map((e) => e.symbol);
    return {
      dateLabel,
      marketOpen: statusQ.data?.marketOpen ?? false,
      futures: mapQuotes(FUTURES).map((x) => ({ label: x.label, changePercent: x.quote!.changePercent })),
      indices: mapQuotes(INDEX_ETFS).map((x) => ({ label: x.label, changePercent: x.quote!.changePercent })),
      yields: mapQuotes(YIELDS).map((x) => ({ label: x.label.replace(' Yield', ''), value: x.quote!.price })),
      commodities: mapQuotes(COMMODITIES).map((x) => ({ label: x.label, price: x.quote!.price, changePercent: x.quote!.changePercent })),
      crypto: mapQuotes(CRYPTO).map((x) => ({ label: x.label, price: x.quote!.price, changePercent: x.quote!.changePercent })),
      fearGreed: fgQ.data?.fgi?.now ?? null,
      topSectors: [...(sectorsQ.data ?? [])]
        .sort((a, b) => b.changePercent - a.changePercent)
        .filter((_, i, a) => i < 3 || i >= a.length - 3)
        .map((s) => ({ name: s.name, changePercent: s.changePercent })),
      gainers: (gainersQ.data ?? []).slice(0, 3).map((g) => ({ symbol: g.symbol, changePercent: g.changePercent })),
      losers: (losersQ.data ?? []).slice(0, 3).map((l) => ({ symbol: l.symbol, changePercent: l.changePercent })),
      earnings: { count: earnings.length, notable },
      headlines: (newsQ.data ?? []).slice(0, 3).map((n) => n.title),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotesQ.data, statusQ.data, fgQ.data, sectorsQ.data, gainersQ.data, losersQ.data, earningsQ.data, newsQ.data]);

  async function generate() {
    if (!digest || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { text, provider } = await runAIPromptWithMeta(buildMorningBriefPrompt(digest), { maxTokens: 2500 });
      const cache: BriefCache = { date: todayKey(), text, provider };
      localStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify(cache));
      setBrief(cache);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  }

  // Auto-generate once per day when data settles
  useEffect(() => {
    if (!brief && !generating && !genError && dataReady && hasAIKey && digest) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, dataReady, hasAIKey, digest == null]);

  function handleMover(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  // ── Earnings split ──
  const bmo = (earningsQ.data ?? []).filter((e) => e.hour === 'bmo').slice(0, 12);
  const amc = (earningsQ.data ?? []).filter((e) => e.hour === 'amc').slice(0, 12);
  const otherEarnings = (earningsQ.data ?? []).filter((e) => e.hour !== 'bmo' && e.hour !== 'amc').slice(0, 6);

  const marketOpen = statusQ.data?.marketOpen;
  const fgNow = fgQ.data?.fgi?.now;

  return (
    <PageShell
      icon={Sunrise}
      iconColor="text-gold bg-gold/10"
      title="Morning Brief"
      subtitle={dateLabel}
      actions={
        <div className="flex items-center gap-2">
          {marketOpen != null && (
            <span className={clsx(
              'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border',
              marketOpen ? 'text-green border-green/30 bg-green/10' : 'text-gold border-gold/30 bg-gold/10'
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', marketOpen ? 'bg-green animate-pulse' : 'bg-gold')} />
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          )}
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {/* ── AI Narrative ── */}
        <div className="card-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <SectionLabel className="!mb-0">Today's Briefing</SectionLabel>
            <button
              onClick={generate}
              disabled={generating || !dataReady || !hasAIKey}
              className="ml-auto flex items-center gap-1 text-[10px] text-text-muted hover:text-white disabled:opacity-40 transition-colors"
              title="Regenerate"
            >
              <RefreshCw className={clsx('w-3 h-3', generating && 'animate-spin')} />
              Regenerate
            </button>
          </div>

          {!hasAIKey && (
            <p className="text-xs text-text-muted">
              Add a Gemini, Groq, or Anthropic key in Settings to get the AI-written daily briefing.
              The live market data below works without it.
            </p>
          )}

          {hasAIKey && generating && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-3.5" style={{ width: `${95 - i * 7}%` }} />
              ))}
            </div>
          )}

          {hasAIKey && !generating && genError && (
            <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3">
              <p className="text-xs text-red-300 mb-2">{genError}</p>
              <button onClick={generate} className="text-[11px] text-white bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 rounded px-2.5 py-1 transition-colors">
                Try again
              </button>
            </div>
          )}

          {!generating && brief && (
            <>
              <Narrative text={brief.text} />
              <p className="text-[9px] text-text-muted/50 mt-3 pt-2 border-t border-border-dim/40">
                Generated by {PROVIDER_LABELS[brief.provider]} · Not financial advice
              </p>
            </>
          )}
        </div>

        {/* ── Futures & Indices ── */}
        <div>
          <SectionLabel>Futures</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FUTURES.map(([sym, label]) => <QuoteStat key={sym} label={label} quote={q(sym)} />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {INDEX_ETFS.map(([sym, label]) => <QuoteStat key={sym} label={label} quote={q(sym)} />)}
          </div>
        </div>

        {/* ── Rates & Commodities ── */}
        <div>
          <SectionLabel>Rates &amp; Commodities</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {YIELDS.map(([sym, label]) => <QuoteStat key={sym} label={label} quote={q(sym)} format="yield" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {COMMODITIES.map(([sym, label]) => <QuoteStat key={sym} label={label} quote={q(sym)} />)}
          </div>
        </div>

        {/* ── Crypto ── */}
        <div>
          <SectionLabel>Crypto</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {CRYPTO.map(([sym, label]) => <QuoteStat key={sym} label={label} quote={q(sym)} format="big" />)}
          </div>
        </div>

        {/* ── Fear & Greed + Sectors ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="card-surface p-4">
            <SectionLabel>Fear &amp; Greed</SectionLabel>
            {fgNow ? (
              <div className="flex items-center gap-4">
                <FearGreedGauge value={fgNow.value} />
                <div>
                  <p className="text-sm font-bold" style={{ color: getFearGreedColor(fgNow.value) }}>{fgNow.valueText}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">CNN-style index</p>
                </div>
              </div>
            ) : (
              <div className="skeleton h-16" />
            )}
          </div>
          <div className="card-surface p-4">
            <SectionLabel>Sectors</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {[...(sectorsQ.data ?? [])]
                .sort((a, b) => b.changePercent - a.changePercent)
                .map((s) => (
                  <span
                    key={s.symbol}
                    className={clsx(
                      'text-[10px] font-medium px-2 py-1 rounded-lg num',
                      s.changePercent >= 0
                        ? 'text-green bg-green/10 border border-green/20'
                        : 'text-red-400 bg-red-400/10 border border-red-400/20'
                    )}
                  >
                    {s.name} {pctText(s.changePercent)}
                  </span>
                ))}
              {sectorsQ.isLoading && <div className="skeleton h-16 w-full" />}
            </div>
          </div>
        </div>

        {/* ── Today's Earnings ── */}
        <div className="card-surface p-4">
          <SectionLabel>Earnings Today {earningsQ.data ? `· ${earningsQ.data.length}` : ''}</SectionLabel>
          {!hasFinnhubKey() ? (
            <p className="text-xs text-text-muted">Add your free Finnhub key in Settings to see today's earnings.</p>
          ) : earningsQ.isLoading ? (
            <div className="skeleton h-20" />
          ) : (earningsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-text-muted">No earnings scheduled today.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gold font-semibold mb-1.5">☀ Before Open</p>
                {bmo.length === 0 && <p className="text-[11px] text-text-muted">None</p>}
                {bmo.map((e) => (
                  <div key={e.symbol} className="flex items-center justify-between py-1 border-b border-border-dim/30 last:border-0">
                    <span className="text-xs font-bold text-white">{e.symbol}</span>
                    <span className="text-[10px] text-text-muted num">{e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)} est` : '—'}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] text-purple font-semibold mb-1.5">☾ After Close</p>
                {amc.length === 0 && <p className="text-[11px] text-text-muted">None</p>}
                {amc.map((e) => (
                  <div key={e.symbol} className="flex items-center justify-between py-1 border-b border-border-dim/30 last:border-0">
                    <span className="text-xs font-bold text-white">{e.symbol}</span>
                    <span className="text-[10px] text-text-muted num">{e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)} est` : '—'}</span>
                  </div>
                ))}
              </div>
              {otherEarnings.length > 0 && (
                <p className="text-[10px] text-text-muted/60 sm:col-span-2">
                  +{otherEarnings.length} more with unspecified timing
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Movers ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="card-surface p-3">
            <div className="flex items-center gap-1.5 px-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green" />
              <SectionLabel className="!mb-0">Top Gainers</SectionLabel>
            </div>
            {(gainersQ.data ?? []).map((g) => <MoverRow key={g.symbol} quote={g} onSelect={() => handleMover(g.symbol)} />)}
            {gainersQ.isLoading && <div className="skeleton h-24 m-2" />}
          </div>
          <div className="card-surface p-3">
            <div className="flex items-center gap-1.5 px-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <SectionLabel className="!mb-0">Top Losers</SectionLabel>
            </div>
            {(losersQ.data ?? []).map((l) => <MoverRow key={l.symbol} quote={l} onSelect={() => handleMover(l.symbol)} />)}
            {losersQ.isLoading && <div className="skeleton h-24 m-2" />}
          </div>
        </div>

        {/* ── Headlines ── */}
        {!!getFmpKey() && (newsQ.data ?? []).length > 0 && (
          <div className="card-surface p-4">
            <SectionLabel>Headlines</SectionLabel>
            <div className="space-y-2.5">
              {(newsQ.data ?? []).slice(0, 5).map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 group">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-200 group-hover:text-white leading-snug transition-colors">{n.title}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{n.site}</p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-text-muted shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-[9px] text-text-muted/40 text-center pb-2">
          Data: Yahoo Finance, Finnhub, FMP, alternative.me · Refreshes every 60s
        </p>
      </div>
    </PageShell>
  );
}
