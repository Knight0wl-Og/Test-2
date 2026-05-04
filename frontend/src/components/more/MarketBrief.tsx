/**
 * MarketBrief — swipeable daily market slide deck.
 * Slide 1 ("THE OPEN") is auto-built from live quotes.
 * Remaining slides are AI-generated (Gemini/Groq) and cached for the day.
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBatchQuotes } from '../../services/api';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────────────────────

type AccentColor = 'blue' | 'orange' | 'green' | 'yellow' | 'red';
type SlideType = 'open' | 'stats-bullets' | 'two-column' | 'watch-list';

interface StatCard {
  label: string;
  value: string;
  change?: string;
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'orange';
}

interface Column {
  title: string;
  titleColor: string;
  points: string[];
}

interface WatchItem {
  title: string;
  titleColor: string;
  borderColor: string;
  description: string;
}

export interface BriefSlide {
  type: SlideType;
  accentColor: AccentColor;
  title: string;
  subtitle?: string;
  authorLine?: string;
  stats?: StatCard[];
  bullets?: string[];
  columns?: Column[];
  items?: WatchItem[];
  slideLabel: string;
}

// ─── Accent color map ────────────────────────────────────────────────────────

const ACCENT: Record<AccentColor, string> = {
  blue: '#4da6ff',
  orange: '#ff6b35',
  green: '#22c55e',
  yellow: '#fbbf24',
  red: '#f87171',
};

// ─── Cache ───────────────────────────────────────────────────────────────────

const CACHE_KEY = 'tradeedge_morning_brief_v2';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadCache(): BriefSlide[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { date, slides } = JSON.parse(raw);
    if (date !== todayKey()) return null;
    return slides as BriefSlide[];
  } catch {
    return null;
  }
}

function saveCache(slides: BriefSlide[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayKey(), slides }));
}

// ─── AI generation ───────────────────────────────────────────────────────────

async function generateSlides(marketContext: string): Promise<BriefSlide[]> {
  const geminiKey = localStorage.getItem('TRADEEDGE_GEMINI_KEY');
  const groqKey = localStorage.getItem('TRADEEDGE_GROQ_KEY');

  const schema = `Return a JSON array of 5-6 slide objects. Each slide must match exactly one of these types:

TYPE "stats-bullets": { type, accentColor, title, stats: [{label,value,change?,color?}], bullets: string[], slideLabel }
TYPE "two-column": { type, accentColor, title, columns: [{title,titleColor,points:string[]}], slideLabel }
TYPE "watch-list": { type:"watch-list", accentColor:"green", title:"WHAT TO WATCH TODAY", items:[{title,titleColor,borderColor,description}], slideLabel }

accentColor must be one of: blue, orange, green, yellow, red
For stats color use: green (positive), red (negative), blue (neutral/rate), yellow (caution)
titleColor/borderColor/titleColor use CSS color strings like "#4da6ff", "#22c55e", "#fbbf24", "#f87171", "#ff6b35"
slideLabel format: "SLIDE N — TOPIC NAME"
The LAST slide must always be type "watch-list" titled "WHAT TO WATCH TODAY".
Return ONLY the JSON array, no markdown, no explanation.`;

  const prompt = `You are a financial markets analyst producing a concise daily morning brief.
Today's market data:
${marketContext}

${schema}`;

  let raw = '';

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        }),
      }
    );
    const data = await res.json();
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } else if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    raw = data?.choices?.[0]?.message?.content ?? '';
  } else {
    throw new Error('No AI key configured — add a Gemini or Groq key in Settings to generate the brief.');
  }

  // Strip markdown code fences if the model wrapped the JSON
  const stripped = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) {
    const preview = raw.slice(0, 120).replace(/\n/g, ' ');
    throw new Error(`AI returned unexpected format: "${preview}"`);
  }
  return JSON.parse(match[0]) as BriefSlide[];
}

// ─── Slide renderers ─────────────────────────────────────────────────────────

function StatCards({ stats }: { stats: StatCard[] }) {
  const colorClass: Record<string, string> = {
    green: 'text-[#22c55e]',
    red: 'text-[#f87171]',
    blue: 'text-[#4da6ff]',
    yellow: 'text-[#fbbf24]',
    orange: 'text-[#ff6b35]',
  };

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {stats.map((s, i) => (
        <div key={i} className="bg-[#151628] rounded-lg p-3 text-center">
          <p className="text-[10px] text-gray-400 mb-1 leading-tight">{s.label}</p>
          <p className={clsx('text-xl font-bold leading-tight', colorClass[s.color ?? 'blue'] ?? 'text-white')}>
            {s.value}
          </p>
          {s.change && <p className="text-[10px] text-gray-500 mt-1 leading-tight">{s.change}</p>}
        </div>
      ))}
    </div>
  );
}

function Bullets({ bullets, accent }: { bullets: string[]; accent: string }) {
  return (
    <div className="space-y-2.5">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-[3px] rounded-full shrink-0 mt-1 self-stretch" style={{ backgroundColor: accent }} />
          <p className="text-sm text-gray-200 leading-snug">{b}</p>
        </div>
      ))}
    </div>
  );
}

function SlideOpen({ slide }: { slide: BriefSlide }) {
  const accent = ACCENT[slide.accentColor];
  return (
    <div className="flex flex-col h-full p-5">
      <p className="text-xs font-semibold tracking-[0.25em] mb-1" style={{ color: accent }}>
        MORNING BRIEF
      </p>
      <h1 className="text-3xl font-bold text-white leading-tight mb-1">{slide.title}</h1>
      {slide.subtitle && <p className="text-sm text-gray-400 mb-3 leading-snug">{slide.subtitle}</p>}
      {slide.authorLine && (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1" style={{ backgroundColor: accent + '60' }} />
          <p className="text-[11px] text-gray-500 shrink-0">{slide.authorLine}</p>
          <div className="h-px flex-1" style={{ backgroundColor: accent + '60' }} />
        </div>
      )}
      {slide.stats && <StatCards stats={slide.stats} />}
      <div className="mt-auto">
        <p className="text-[10px] text-gray-600 italic">{slide.slideLabel}</p>
      </div>
    </div>
  );
}

function SlideStatsBullets({ slide }: { slide: BriefSlide }) {
  const accent = ACCENT[slide.accentColor];
  return (
    <div className="flex flex-col h-full p-5">
      <h2 className="text-2xl font-bold text-white mb-4">{slide.title}</h2>
      {slide.stats && <StatCards stats={slide.stats} />}
      <div className="h-px mb-4" style={{ backgroundColor: accent + '50' }} />
      {slide.bullets && <Bullets bullets={slide.bullets} accent={accent} />}
      <div className="mt-auto pt-3">
        <p className="text-[10px] text-gray-600 italic">{slide.slideLabel}</p>
      </div>
    </div>
  );
}

function SlideTwoColumn({ slide }: { slide: BriefSlide }) {
  return (
    <div className="flex flex-col h-full p-5">
      <h2 className="text-2xl font-bold text-white mb-4">{slide.title}</h2>
      <div className="grid grid-cols-2 gap-3 flex-1">
        {slide.columns?.map((col, i) => (
          <div key={i} className="bg-[#151628] rounded-lg p-3 flex flex-col">
            <div className="h-[2px] rounded-full mb-2" style={{ backgroundColor: col.titleColor }} />
            <p className="text-sm font-semibold mb-2 leading-tight" style={{ color: col.titleColor }}>
              {col.title}
            </p>
            <div className="space-y-2">
              {col.points.map((pt, j) => (
                <p
                  key={j}
                  className={clsx(
                    'text-xs leading-snug',
                    j === col.points.length - 1 ? 'text-[#fbbf24]' : 'text-gray-300'
                  )}
                >
                  {pt}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <p className="text-[10px] text-gray-600 italic">{slide.slideLabel}</p>
      </div>
    </div>
  );
}

function SlideWatchList({ slide }: { slide: BriefSlide }) {
  return (
    <div className="flex flex-col h-full p-5">
      <h2 className="text-2xl font-bold text-white mb-4">{slide.title}</h2>
      <div className="space-y-2.5 flex-1">
        {slide.items?.map((item, i) => (
          <div
            key={i}
            className="bg-[#151628] rounded-lg p-3 flex gap-3 items-start"
            style={{ borderLeft: `3px solid ${item.borderColor}` }}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight mb-0.5" style={{ color: item.titleColor }}>
                {item.title}
              </p>
              <p className="text-xs text-gray-400 leading-snug">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <p className="text-[10px] text-gray-600 italic">{slide.slideLabel}</p>
      </div>
    </div>
  );
}

function SlideCard({ slide }: { slide: BriefSlide }) {
  const accent = ACCENT[slide.accentColor];
  return (
    <div
      className="snap-center shrink-0 w-full h-full bg-[#0a0b14] rounded-xl overflow-hidden flex flex-col"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      {slide.type === 'open' && <SlideOpen slide={slide} />}
      {slide.type === 'stats-bullets' && <SlideStatsBullets slide={slide} />}
      {slide.type === 'two-column' && <SlideTwoColumn slide={slide} />}
      {slide.type === 'watch-list' && <SlideWatchList slide={slide} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketBrief() {
  const [slides, setSlides] = useState<BriefSlide[]>(() => loadCache() ?? []);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch live market data for Slide 1
  const { data: quotes } = useQuery({
    queryKey: ['brief-quotes'],
    queryFn: () => fetchBatchQuotes(['SPY', 'QQQ', 'DIA', '^VIX', 'CL=F', '^TNX']),
    staleTime: 60_000,
  });

  // Build Slide 1 from live quotes
  function buildOpenSlide(qs: typeof quotes): BriefSlide {
    const get = (sym: string) => qs?.find((q) => q.symbol === sym);
    const spy = get('SPY');
    const qqq = get('QQQ');
    const dia = get('DIA');
    const vix = get('^VIX');
    const oil = get('CL=F');
    const tnx = get('^TNX');

    const fmt = (v: number | undefined, decimals = 2) =>
      v != null ? (v >= 0 ? '+' : '') + v.toFixed(decimals) + '%' : '—';
    const fmtPrice = (v: number | undefined, decimals = 2) =>
      v != null ? v.toFixed(decimals) : '—';
    const pctColor = (v: number | undefined): StatCard['color'] =>
      v == null ? 'blue' : v >= 0 ? 'green' : 'red';

    const today = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    return {
      type: 'open',
      accentColor: 'blue',
      title: today,
      subtitle: 'Daily Market Open — live data',
      authorLine: 'TradeEdge  |  Market Intelligence',
      stats: [
        { label: 'S&P 500', value: fmt(spy?.changePercent), color: pctColor(spy?.changePercent) },
        { label: 'NASDAQ', value: fmt(qqq?.changePercent), color: pctColor(qqq?.changePercent) },
        { label: 'DOW', value: fmt(dia?.changePercent), color: pctColor(dia?.changePercent) },
        { label: 'VIX', value: fmtPrice(vix?.price, 2), change: vix?.changePercent != null ? fmt(vix.changePercent) : undefined, color: (vix?.changePercent ?? 0) > 0 ? 'red' : 'green' },
        { label: 'WTI Crude', value: `$${fmtPrice(oil?.price)}`, change: oil?.changePercent != null ? fmt(oil.changePercent) : undefined, color: pctColor(oil?.changePercent) },
        { label: '10Y Yield', value: `${fmtPrice(tnx?.price)}%`, change: tnx?.changePercent != null ? fmt(tnx.changePercent) : undefined, color: 'blue' },
      ],
      slideLabel: 'SLIDE 1 — THE OPEN',
    };
  }

  // Replace/update Slide 1 whenever quotes arrive
  useEffect(() => {
    if (!quotes) return;
    const openSlide = buildOpenSlide(quotes);
    setSlides((prev) => {
      if (prev.length === 0) return [openSlide];
      return [openSlide, ...prev.slice(1)];
    });
  }, [quotes]);

  async function generate(force = false) {
    if (!force && slides.length > 1) return; // cached
    setGenerating(true);
    setGenError('');
    try {
      const spy = quotes?.find((q) => q.symbol === 'SPY');
      const qqq = quotes?.find((q) => q.symbol === 'QQQ');
      const vix = quotes?.find((q) => q.symbol === '^VIX');
      const oil = quotes?.find((q) => q.symbol === 'CL=F');

      const ctx = [
        `Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        spy ? `S&P 500 (SPY): ${spy.changePercent >= 0 ? '+' : ''}${spy.changePercent.toFixed(2)}%` : '',
        qqq ? `NASDAQ (QQQ): ${qqq.changePercent >= 0 ? '+' : ''}${qqq.changePercent.toFixed(2)}%` : '',
        vix ? `VIX: ${vix.price.toFixed(2)} (${vix.changePercent >= 0 ? '+' : ''}${vix.changePercent.toFixed(2)}%)` : '',
        oil ? `WTI Crude: $${oil.price.toFixed(2)} (${oil.changePercent >= 0 ? '+' : ''}${oil.changePercent.toFixed(2)}%)` : '',
      ].filter(Boolean).join('\n');

      const aiSlides = await generateSlides(ctx);
      const openSlide = buildOpenSlide(quotes);
      const all: BriefSlide[] = [openSlide, ...aiSlides];
      setSlides(all);
      saveCache(all);
      setCurrent(0);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  // Scroll to current slide
  function scrollTo(idx: number) {
    if (!scrollRef.current) return;
    const w = scrollRef.current.offsetWidth;
    scrollRef.current.scrollTo({ left: idx * w, behavior: 'smooth' });
    setCurrent(idx);
  }

  // Track scroll position → update dot
  function handleScroll() {
    if (!scrollRef.current) return;
    const w = scrollRef.current.offsetWidth;
    const idx = Math.round(scrollRef.current.scrollLeft / w);
    setCurrent(idx);
  }

  const hasSlides = slides.length > 0;

  return (
    <div className="mb-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Morning Brief</h2>
          <p className="text-[11px] text-text-muted">Daily market summary</p>
        </div>
        <button
          onClick={() => generate(true)}
          disabled={generating}
          className="flex items-center gap-1.5 text-[11px] text-accent hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-3 h-3', generating && 'animate-spin')} />
          {generating ? 'Generating…' : slides.length > 1 ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {genError && (
        <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded-lg text-[11px] text-red-300">
          {genError}
        </div>
      )}

      {/* Slide deck */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-xl"
          style={{ height: 280 }}
        >
          {hasSlides ? (
            slides.map((slide, i) => (
              <div key={i} className="snap-center shrink-0 w-full h-full px-0.5 first:pl-0 last:pr-0">
                <SlideCard slide={slide} />
              </div>
            ))
          ) : (
            /* Empty state / generate prompt */
            <div className="snap-center shrink-0 w-full h-full bg-[#0a0b14] rounded-xl border border-border-dim/40 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-text-muted text-center px-6 leading-relaxed">
                Generate your daily morning brief — market summary, macro backdrop, key themes, and what to watch.
              </p>
              <button
                onClick={() => generate(false)}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', generating && 'animate-spin')} />
                {generating ? 'Generating…' : 'Generate Brief'}
              </button>
              {!localStorage.getItem('TRADEEDGE_GEMINI_KEY') && !localStorage.getItem('TRADEEDGE_GROQ_KEY') && (
                <p className="text-[10px] text-text-muted/60 text-center px-8">
                  Requires a free Gemini or Groq key — add one in Settings
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nav arrows (shown when >1 slide) */}
        {slides.length > 1 && (
          <>
            {current > 0 && (
              <button
                onClick={() => scrollTo(current - 1)}
                className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
            )}
            {current < slides.length - 1 && (
              <button
                onClick={() => scrollTo(current + 1)}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={clsx(
                'rounded-full transition-all',
                i === current ? 'w-4 h-1.5 bg-accent' : 'w-1.5 h-1.5 bg-border-dim hover:bg-text-muted'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
