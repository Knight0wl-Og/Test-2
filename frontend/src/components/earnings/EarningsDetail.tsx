/**
 * EarningsDetail — full-screen slide-up sheet shown when tapping a company
 * in the Earnings Calendar. Shows:
 *  - Live price + key stats (Mkt Cap, P/E, P/S)
 *  - Revenue / EPS bar chart (8 quarters, estimate vs actual)
 *  - Beat streak stat
 *  - Upcoming earnings card (amber)
 *  - Previous earnings cards (green)
 *  - AI recap (generate on demand)
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { fetchBatchQuotes } from '../../services/api';
import { fetchEarningsCalendar } from '../../services/finnhubService';
import {
  fetchKeyMetricsFMP,
  fetchAnalystEstimatesFMP,
  getFmpKey,
} from '../../services/fmpService';
import { runAIPrompt, getActiveProvider } from '../../services/aiService';
import clsx from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBig(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q}'${String(d.getFullYear()).slice(2)}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T12:00:00');
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── Logo with fallback ───────────────────────────────────────────────────────

const LOGO_COLORS = ['#1e40af','#065f46','#7c2d12','#581c87','#134e4a','#1e3a5f'];
function symbolColor(sym: string) {
  let n = 0; for (const c of sym) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return LOGO_COLORS[n % LOGO_COLORS.length];
}

function SymbolLogo({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  return err ? (
    <div className="rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0" style={{ width: size, height: size, backgroundColor: symbolColor(symbol) }}>{symbol[0]}</div>
  ) : (
    <img src={`https://financialmodelingprep.com/image-stock/${symbol}.png`} alt={symbol} className="rounded-xl object-cover shrink-0" style={{ width: size, height: size }} onError={() => setErr(true)} />
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

interface BarEntry {
  label: string;
  estimate: number | null;
  actual: number | null;
}

function BarChart({ data, color }: { data: BarEntry[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    if (containerRef.current) setWidth(containerRef.current.clientWidth);
  }, []);

  const valid = data.filter((d) => d.actual != null || d.estimate != null);
  if (valid.length === 0) return <div className="flex items-center justify-center h-32 text-xs text-gray-600">No chart data</div>;

  const maxVal = Math.max(...valid.flatMap((d) => [d.estimate ?? 0, d.actual ?? 0]));
  const chartH = 120;
  const labelH = 20;
  const totalH = chartH + labelH;
  const groupW = Math.max(28, Math.floor((width - 16) / valid.length));
  const barW = Math.floor(groupW * 0.38);
  const totalW = groupW * valid.length + 8;

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg width={Math.max(totalW, width)} height={totalH} className="overflow-visible">
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line key={pct} x1={4} x2={totalW - 4} y1={chartH - pct * chartH} y2={chartH - pct * chartH} stroke="#1f2937" strokeWidth={1} />
        ))}
        {valid.map((d, i) => {
          const x = i * groupW + 4;
          const estH = d.estimate != null ? (d.estimate / maxVal) * chartH : 0;
          const actH = d.actual != null ? (d.actual / maxVal) * chartH : 0;
          const beat = d.actual != null && d.estimate != null && d.actual >= d.estimate;
          return (
            <g key={i}>
              {/* Estimate bar */}
              {d.estimate != null && (
                <rect x={x} y={chartH - estH} width={barW} height={estH} rx={2} fill="#374151" />
              )}
              {/* Actual bar */}
              {d.actual != null && (
                <rect x={x + barW + 2} y={chartH - actH} width={barW} height={actH} rx={2} fill={beat ? color : '#ef4444'} opacity={0.9} />
              )}
              {/* Label */}
              <text x={x + barW} y={totalH - 2} textAnchor="middle" fontSize={8} fill="#6b7280">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 px-1">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-[#374151]" /><span className="text-[9px] text-gray-500">Estimate</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} /><span className="text-[9px] text-gray-500">Actual (beat)</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" /><span className="text-[9px] text-gray-500">Actual (miss)</span></div>
      </div>
    </div>
  );
}

// ─── Upcoming earnings card ───────────────────────────────────────────────────

function UpcomingCard({ entry, analystEst }: {
  entry: { date: string; epsEstimate: number | null; revenueEstimate: number | null; hour?: string };
  analystEst: { estimatedRevenueAvg: number; estimatedEpsAvg: number } | null;
}) {
  const days = daysUntil(entry.date);
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} Days`;
  const d = new Date(entry.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const revEst = analystEst?.estimatedRevenueAvg ?? entry.revenueEstimate;
  const epsEst = analystEst?.estimatedEpsAvg ?? entry.epsEstimate;

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-700/30" style={{ background: 'linear-gradient(135deg, #1c1100 0%, #2a1800 100%)' }}>
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <p className="text-base font-bold text-amber-300">Earnings {label}</p>
          <p className="text-xs text-amber-500/80 mt-0.5">{dateStr}</p>
        </div>
        <span className="text-xl mt-0.5">{entry.hour === 'bmo' ? '☀️' : '🌙'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <div className="bg-black/30 rounded-xl p-3">
          <p className="text-[10px] text-amber-500/70 mb-0.5">Revenue</p>
          <p className="text-sm font-bold text-white">{revEst != null ? fmtBig(revEst) : '—'} <span className="text-[10px] text-amber-500/60 font-normal">(est)</span></p>
        </div>
        <div className="bg-black/30 rounded-xl p-3">
          <p className="text-[10px] text-amber-500/70 mb-0.5">EPS</p>
          <p className="text-sm font-bold text-white">{epsEst != null ? `$${fmtNum(epsEst, 2)}` : '—'} <span className="text-[10px] text-amber-500/60 font-normal">(est)</span></p>
        </div>
      </div>
    </div>
  );
}

// ─── Previous earnings card ───────────────────────────────────────────────────

function PrevCard({ entry }: { entry: { date: string; epsEstimate: number | null; epsActual: number | null; revenueEstimate: number | null; revenueActual: number | null; surprise: number | null; hour?: string } }) {
  const label = quarterLabel(entry.date);
  const d = new Date(entry.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const revBeat = entry.revenueActual != null && entry.revenueEstimate != null && entry.revenueActual >= entry.revenueEstimate;
  const epsBeat = entry.epsActual != null && entry.epsEstimate != null && entry.epsActual >= entry.epsEstimate;

  const revPct = entry.revenueActual != null && entry.revenueEstimate != null && entry.revenueEstimate !== 0
    ? ((entry.revenueActual - entry.revenueEstimate) / Math.abs(entry.revenueEstimate)) * 100 : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-green-900/30" style={{ background: 'linear-gradient(135deg, #051a0e 0%, #0a2517 100%)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-green-900/20">
        <div>
          <p className="text-sm font-bold text-green-300">{label} Earnings</p>
          <p className="text-[11px] text-green-600/70 mt-0.5">{dateStr}</p>
        </div>
        <span className="text-lg">🕐</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {/* REV row */}
        <div className="grid grid-cols-3 gap-1 text-xs items-center">
          <span className="text-gray-400 font-semibold">REV</span>
          <span className="text-gray-500">{entry.revenueEstimate != null ? `${fmtBig(entry.revenueEstimate)} (est)` : '—'}</span>
          <div className="flex items-center gap-1 justify-end">
            <span className="text-white font-medium">{entry.revenueActual != null ? fmtBig(entry.revenueActual) : '—'}</span>
            {revPct != null && <span className={clsx('text-[10px] font-bold', revBeat ? 'text-green-400' : 'text-red-400')}>{revPct >= 0 ? '+' : ''}{revPct.toFixed(2)}%</span>}
          </div>
        </div>
        {/* EPS row */}
        <div className="grid grid-cols-3 gap-1 text-xs items-center">
          <span className="text-gray-400 font-semibold">EPS</span>
          <span className="text-gray-500">{entry.epsEstimate != null ? `$${fmtNum(entry.epsEstimate, 2)} (est)` : '—'}</span>
          <div className="flex items-center gap-1 justify-end">
            <span className="text-white font-medium">{entry.epsActual != null ? `$${fmtNum(entry.epsActual, 2)}` : '—'}</span>
            {entry.surprise != null && <span className={clsx('text-[10px] font-bold', epsBeat ? 'text-green-400' : 'text-red-400')}>{entry.surprise >= 0 ? '+' : ''}{entry.surprise.toFixed(2)}%</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI recap card ────────────────────────────────────────────────────────────

function AIRecap({ symbol, earningsData }: {
  symbol: string;
  earningsData: Array<{ date: string; epsEstimate: number | null; epsActual: number | null; surprise: number | null }>;
}) {
  const [recap, setRecap] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const provider = getActiveProvider();

  async function generate() {
    setLoading(true); setError(''); setRecap('');
    try {
      const recent = earningsData.slice(0, 4).map((e) =>
        `${quarterLabel(e.date)}: EPS est $${e.epsEstimate?.toFixed(2) ?? '?'}, actual $${e.epsActual?.toFixed(2) ?? 'pending'}${e.surprise != null ? `, surprise ${e.surprise >= 0 ? '+' : ''}${e.surprise.toFixed(1)}%` : ''}`
      ).join('\n');
      const prompt = `You are a concise financial analyst. Based on this recent earnings history for ${symbol}, write a brief 3-5 bullet recap covering: earnings trend, beat/miss pattern, and key takeaway. Be direct and specific.

${symbol} Recent Earnings:
${recent}

Format as short bullet points starting with •. No headers, no disclaimers.`;
      const text = await runAIPrompt(prompt);
      setRecap(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-purple-900/30" style={{ background: 'linear-gradient(135deg, #0d0520 0%, #130830 100%)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-900/20">
        <div>
          <p className="text-sm font-bold text-purple-300">AI Earnings Recap</p>
          <p className="text-[10px] text-purple-500/60 mt-0.5">AI generated · may be inaccurate</p>
        </div>
        <Sparkles className="w-4 h-4 text-purple-400" />
      </div>
      <div className="px-4 py-3">
        {!provider && <p className="text-xs text-gray-500">Add a Gemini, Groq or Anthropic key in Settings to generate AI recaps.</p>}
        {provider && !recap && !loading && (
          <button onClick={generate} className="w-full py-2.5 rounded-xl bg-purple-900/30 border border-purple-700/30 text-sm font-medium text-purple-300 hover:bg-purple-900/50 transition-colors">
            Generate Recap
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-purple-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {recap && (
          <div className="space-y-2">
            {recap.split('\n').filter(l => l.trim()).map((line, i) => (
              <p key={i} className="text-sm text-gray-300 leading-snug">{line}</p>
            ))}
            <button onClick={generate} className="mt-2 text-[10px] text-purple-500 hover:text-purple-300 flex items-center gap-1 transition-colors">
              <RefreshCw className="w-2.5 h-2.5" /> Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  symbol: string;
  onClose: () => void;
  onViewChart: () => void;
}

export function EarningsDetail({ symbol, onClose, onViewChart }: Props) {
  const [tab, setTab] = useState<'earnings' | 'history'>('earnings');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'eps'>('revenue');
  const hasFmp = !!getFmpKey();
  const today = todayStr();

  // Live quote
  const { data: quotes } = useQuery({
    queryKey: ['eq-quote', symbol],
    queryFn: () => fetchBatchQuotes([symbol]),
    staleTime: 30_000,
  });
  const quote = quotes?.[0];

  // Earnings calendar (past + upcoming from Finnhub — free)
  const { data: calendar = [], isLoading: calLoading } = useQuery({
    queryKey: ['eq-calendar', symbol],
    queryFn: () => fetchEarningsCalendar(symbol),
    staleTime: 60 * 60_000,
  });

  // Key metrics (P/E, Mkt Cap) — FMP free
  const { data: metrics } = useQuery({
    queryKey: ['eq-metrics', symbol],
    queryFn: () => fetchKeyMetricsFMP(symbol),
    enabled: hasFmp,
    staleTime: 24 * 60 * 60_000,
  });
  const metric = metrics?.[0];

  // Analyst estimates for next quarter — FMP free
  const { data: estimates } = useQuery({
    queryKey: ['eq-estimates', symbol],
    queryFn: () => fetchAnalystEstimatesFMP(symbol, 'quarter'),
    enabled: hasFmp,
    staleTime: 24 * 60 * 60_000,
  });
  const nextEstimate = estimates?.find((e) => e.date > today) ?? null;

  // Split calendar into past and upcoming
  const pastEntries = calendar.filter((e) => e.date <= today && e.epsActual != null).slice().reverse();
  const upcomingEntry = calendar.find((e) => e.date > today);

  // Beat stat
  const withData = pastEntries.filter((e) => e.epsActual != null && e.epsEstimate != null);
  const revWithData = pastEntries.filter((e) => e.revenueActual != null && e.revenueEstimate != null);
  const epsBeatCount = withData.filter((e) => (e.epsActual ?? 0) >= (e.epsEstimate ?? 0)).length;
  const revBeatCount = revWithData.filter((e) => (e.revenueActual ?? 0) >= (e.revenueEstimate ?? 0)).length;

  // Chart data
  const chartData: BarEntry[] = pastEntries.slice(0, 8).reverse().map((e) => ({
    label: quarterLabel(e.date),
    estimate: chartMetric === 'revenue' ? e.revenueEstimate : e.epsEstimate,
    actual: chartMetric === 'revenue' ? e.revenueActual : e.epsActual,
  }));

  const priceColor = (quote?.changePercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Sheet */}
      <div className="relative mt-auto bg-[#0a0b14] rounded-t-3xl border-t border-white/10 flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <SymbolLogo symbol={symbol} size={40} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">{symbol}</span>
                {quote && (
                  <span className={clsx('text-sm font-bold', priceColor)}>
                    ${quote.price?.toFixed(2)}
                  </span>
                )}
              </div>
              {quote && (
                <span className={clsx('text-xs', priceColor)}>
                  {(quote.changePercent ?? 0) >= 0 ? '+' : ''}{(quote.changePercent ?? 0).toFixed(2)}% today
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onViewChart} className="flex items-center gap-1 text-[11px] text-accent border border-accent/30 rounded-lg px-2.5 py-1.5 hover:bg-accent/10 transition-colors">
              Chart <ChevronRight className="w-3 h-3" />
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {hasFmp && metric && (
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/5 shrink-0">
            {metric.marketCap > 0 && <div><p className="text-[9px] text-gray-500 uppercase tracking-wider">Mkt Cap</p><p className="text-xs font-semibold text-white">{fmtBig(metric.marketCap)}</p></div>}
            {metric.pe > 0 && <div><p className="text-[9px] text-gray-500 uppercase tracking-wider">P/E</p><p className="text-xs font-semibold text-white">{fmtNum(metric.pe, 1)}</p></div>}
            {metric.priceToSalesRatio > 0 && <div><p className="text-[9px] text-gray-500 uppercase tracking-wider">P/S</p><p className="text-xs font-semibold text-white">{fmtNum(metric.priceToSalesRatio, 1)}</p></div>}
            {metric.roe > 0 && <div><p className="text-[9px] text-gray-500 uppercase tracking-wider">ROE</p><p className="text-xs font-semibold text-white">{(metric.roe * 100).toFixed(1)}%</p></div>}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/5 shrink-0">
          {(['earnings', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('flex-1 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2',
                tab === t ? 'text-white border-accent' : 'text-gray-500 border-transparent'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {calLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-bg-card rounded-2xl animate-pulse" />)}
            </div>
          )}

          {!calLoading && tab === 'earnings' && (
            <>
              {/* Chart */}
              {chartData.length > 0 && (
                <div className="bg-[#0d0e1a] rounded-2xl border border-white/5 p-3">
                  <div className="flex items-center gap-2 mb-3">
                    {(['revenue', 'eps'] as const).map((m) => (
                      <button key={m} onClick={() => setChartMetric(m)}
                        className={clsx('px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                          chartMetric === m ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-gray-300'
                        )}>
                        {m === 'revenue' ? 'Revenue' : 'EPS'}
                      </button>
                    ))}
                  </div>
                  <BarChart data={chartData} color={chartMetric === 'revenue' ? '#3b82f6' : '#22c55e'} />
                </div>
              )}

              {/* Beat stat */}
              {withData.length > 0 && (
                <div className="flex gap-2">
                  {revWithData.length > 0 && (
                    <div className="flex-1 bg-[#0d0e1a] rounded-xl border border-white/5 px-3 py-2.5">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">REV Beat Rate</p>
                      <p className="text-sm font-bold text-white">{revBeatCount}<span className="text-gray-500 font-normal text-xs"> / {revWithData.length} Q</span></p>
                    </div>
                  )}
                  <div className="flex-1 bg-[#0d0e1a] rounded-xl border border-white/5 px-3 py-2.5">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">EPS Beat Rate</p>
                    <p className="text-sm font-bold text-white">{epsBeatCount}<span className="text-gray-500 font-normal text-xs"> / {withData.length} Q</span></p>
                  </div>
                </div>
              )}

              {/* Upcoming earnings */}
              {upcomingEntry && (
                <UpcomingCard entry={{ ...upcomingEntry, hour: (upcomingEntry as any).hour }} analystEst={nextEstimate} />
              )}

              {/* Most recent quarter */}
              {pastEntries.slice(0, 1).map((e, i) => <PrevCard key={i} entry={e as any} />)}

              {/* AI recap */}
              {pastEntries.length > 0 && <AIRecap symbol={symbol} earningsData={pastEntries} />}
            </>
          )}

          {!calLoading && tab === 'history' && (
            <>
              {pastEntries.length === 0 && (
                <p className="text-center text-text-muted text-sm py-8">No earnings history available</p>
              )}
              {pastEntries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Previous Earnings</p>
                  <div className="space-y-3">
                    {pastEntries.map((e, i) => <PrevCard key={i} entry={e as any} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
