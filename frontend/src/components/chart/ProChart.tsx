import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type MouseEventParams,
} from 'lightweight-charts';
import { Bell, Camera, PenLine, Minus, Undo2, Eraser } from 'lucide-react';
import clsx from 'clsx';
import type { OHLCVBar } from '../../types';
import { useHistory } from '../../hooks/useHistory';
import { useQuote } from '../../hooks/useQuotes';
import { useEarnings } from '../../hooks/useEarnings';
import { loadAlerts } from '../../services/alertsService';
import { AddAlertModal } from '../common/AddAlertModal';
import {
  loadDrawings, saveDrawings, renderDrawings,
  type Drawing, type DrawingTool, type DrawPoint,
} from './chartDrawings';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Timeframe = '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
type ChartType = 'candle' | 'bar' | 'line';

interface IndicatorState {
  sma20:  boolean;
  sma50:  boolean;
  sma100: boolean;
  sma200: boolean;
  ema20:  boolean;
  ema50:  boolean;
  bb:     boolean;
  vwap:   boolean;
  volume: boolean;
  rsi:    boolean;
  macd:   boolean;
}

interface OHLCTooltip {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePct: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIMEFRAME_CONFIG: Record<Timeframe, { period: string; interval: string; isIntraday: boolean }> = {
  '5m':  { period: '1mo',  interval: '5m',  isIntraday: true  },
  '15m': { period: '1mo',  interval: '15m', isIntraday: true  },
  '30m': { period: '3mo',  interval: '30m', isIntraday: true  },
  '1h':  { period: '2y',   interval: '60m', isIntraday: true  },
  '4h':  { period: '2y',   interval: '60m', isIntraday: false },
  '1d':  { period: '5y',   interval: '1d',  isIntraday: false },
  '1w':  { period: '5y',   interval: '1wk', isIntraday: false },
};

const COLORS = {
  bg: '#0a0a0f',
  grid: '#13131f',
  text: '#6b7280',
  crosshair: '#374151',
  upCandle: '#26a69a',
  downCandle: '#ef5350',
  volume: { up: 'rgba(38,166,154,0.25)', down: 'rgba(239,83,80,0.25)' },
  sma20:  '#3b82f6',   // blue   — fast (20-day)
  sma50:  '#22c55e',   // green  — medium (50-day)
  sma100: '#f97316',   // orange — medium-slow (100-day)
  sma200: '#ef4444',   // red    — slow / institutional (200-day)
  ema20:  '#eab308',   // yellow
  ema50:  '#ec4899',   // pink
  bb:     'rgba(96,165,250,0.6)',  // light blue bands
  bbFill: 'rgba(96,165,250,0.28)',
  vwap:   '#f59e0b',   // gold
  rsi:    '#a78bfa',   // purple
  macd:   '#3b82f6',
  macdSignal: '#f97316',
  macdHistUp: 'rgba(34,197,94,0.5)',
  macdHistDown: 'rgba(239,68,68,0.5)',
  alertLine: '#f59e0b',
};

const PREFS_KEY = 'tradeedge_chart_prefs_v1';

const ALL_TIMEFRAMES: Timeframe[] = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'];

const DEFAULT_INDICATORS: IndicatorState = {
  sma20: true, sma50: true, sma100: false, sma200: true,
  ema20: false, ema50: false, bb: false, vwap: false,
  volume: true, rsi: true, macd: false,
};

interface ChartPrefs {
  timeframe: Timeframe;
  chartType: ChartType;
  indicators: IndicatorState;
}

function loadPrefs(): Partial<ChartPrefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Pane layout — panes stack from bottom: volume, MACD, RSI, price on top.
 * Fractions are of total chart height.
 */
function paneMargins(ind: IndicatorState) {
  const vol  = ind.volume ? 0.10 : 0;
  const macd = ind.macd   ? 0.16 : 0;
  const rsi  = ind.rsi    ? 0.16 : 0;
  return {
    main: { top: 0.05, bottom: Math.min(vol + macd + rsi + 0.04, 0.60) },
    rsi:  { top: Math.max(1 - (rsi + macd + vol), 0.05), bottom: macd + vol },
    macd: { top: Math.max(1 - (macd + vol), 0.05), bottom: vol },
    vol:  { top: 0.90, bottom: 0 },
  };
}

// ─── Utility: 4H aggregation ─────────────────────────────────────────────────

function aggregate4h(bars: OHLCVBar[]): OHLCVBar[] {
  const buckets = new Map<number, OHLCVBar[]>();
  for (const bar of bars) {
    const snap = bar.time - (bar.time % (4 * 3600));
    if (!buckets.has(snap)) buckets.set(snap, []);
    buckets.get(snap)!.push(bar);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, grp]) => ({
      time,
      open:   grp[0].open,
      high:   Math.max(...grp.map((b) => b.high)),
      low:    Math.min(...grp.map((b) => b.low)),
      close:  grp[grp.length - 1].close,
      volume: grp.reduce((s, b) => s + b.volume, 0),
    }));
}

// ─── Indicator math ──────────────────────────────────────────────────────────

type Point = { time: number; value: number };

function calculateSMA(bars: OHLCVBar[], period: number): Point[] {
  if (bars.length < period) return [];
  const result: Point[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  result.push({ time: bars[period - 1].time, value: sum / period });
  for (let i = period; i < bars.length; i++) {
    sum += bars[i].close - bars[i - period].close;
    result.push({ time: bars[i].time, value: sum / period });
  }
  return result;
}

function calculateEMA(bars: OHLCVBar[], period: number): Point[] {
  if (bars.length < period) return [];
  const result: Point[] = [];
  let seed = 0;
  for (let i = 0; i < period; i++) seed += bars[i].close;
  seed /= period;
  result.push({ time: bars[period - 1].time, value: seed });
  const k = 2 / (period + 1);
  let prev = seed;
  for (let i = period; i < bars.length; i++) {
    prev = bars[i].close * k + prev * (1 - k);
    result.push({ time: bars[i].time, value: prev });
  }
  return result;
}

/** Bollinger Bands: SMA(20) ± 2 standard deviations */
function calculateBollinger(bars: OHLCVBar[], period = 20, mult = 2): { upper: Point[]; mid: Point[]; lower: Point[] } {
  const upper: Point[] = [];
  const mid: Point[] = [];
  const lower: Point[] = [];
  if (bars.length < period) return { upper, mid, lower };
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (bars[j].close - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    const t = bars[i].time;
    mid.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + mult * sd });
    lower.push({ time: t, value: mean - mult * sd });
  }
  return { upper, mid, lower };
}

/** VWAP with session (UTC-day) reset — intraday timeframes only */
function calculateVWAP(bars: OHLCVBar[]): Point[] {
  const result: Point[] = [];
  let day = '';
  let cumPV = 0;
  let cumV = 0;
  for (const b of bars) {
    const d = new Date(b.time * 1000).toISOString().slice(0, 10);
    if (d !== day) { day = d; cumPV = 0; cumV = 0; }
    const typical = (b.high + b.low + b.close) / 3;
    cumPV += typical * b.volume;
    cumV += b.volume;
    if (cumV > 0) result.push({ time: b.time, value: cumPV / cumV });
  }
  return result;
}

/** MACD 12/26/9 */
function calculateMACD(bars: OHLCVBar[]): { macd: Point[]; signal: Point[]; hist: Point[] } {
  const macdLine: Point[] = [];
  const signal: Point[] = [];
  const hist: Point[] = [];
  if (bars.length < 26) return { macd: macdLine, signal, hist };

  const closes = bars.map((b) => b.close);
  const emaOf = (period: number): (number | null)[] => {
    const out: (number | null)[] = new Array(closes.length).fill(null);
    let seed = 0;
    for (let i = 0; i < period; i++) seed += closes[i];
    seed /= period;
    out[period - 1] = seed;
    const k = 2 / (period + 1);
    for (let i = period; i < closes.length; i++) out[i] = closes[i] * k + (out[i - 1] as number) * (1 - k);
    return out;
  };

  const fast = emaOf(12);
  const slow = emaOf(26);
  const macdVals: (number | null)[] = closes.map((_, i) =>
    fast[i] != null && slow[i] != null ? (fast[i] as number) - (slow[i] as number) : null
  );

  // Signal = EMA(9) of MACD over its non-null region
  const first = macdVals.findIndex((v) => v != null);
  const sigVals: (number | null)[] = new Array(closes.length).fill(null);
  if (first >= 0 && closes.length - first >= 9) {
    let seed = 0;
    for (let i = first; i < first + 9; i++) seed += macdVals[i] as number;
    seed /= 9;
    sigVals[first + 8] = seed;
    const k = 2 / 10;
    for (let i = first + 9; i < closes.length; i++) {
      sigVals[i] = (macdVals[i] as number) * k + (sigVals[i - 1] as number) * (1 - k);
    }
  }

  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    if (macdVals[i] != null) macdLine.push({ time: t, value: macdVals[i] as number });
    if (sigVals[i] != null) signal.push({ time: t, value: sigVals[i] as number });
    if (macdVals[i] != null && sigVals[i] != null) {
      hist.push({ time: t, value: (macdVals[i] as number) - (sigVals[i] as number) });
    }
  }
  return { macd: macdLine, signal, hist };
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtVol(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function Tooltip({ tip, visible }: { tip: OHLCTooltip | null; visible: boolean }) {
  if (!visible || !tip) return null;
  const pos = tip.change >= 0;
  return (
    <div className="absolute top-1 left-2 z-10 bg-bg-secondary/90 border border-panel rounded px-2 py-1 text-[10px] font-mono pointer-events-none select-none">
      <span className="text-text-muted mr-2">{tip.time}</span>
      <span className="text-gray-300 mr-3">
        O:<span className="text-white ml-0.5">{fmt(tip.open)}</span>{' '}
        H:<span className="text-white ml-0.5">{fmt(tip.high)}</span>{' '}
        L:<span className="text-white ml-0.5">{fmt(tip.low)}</span>{' '}
        C:<span className={clsx('ml-0.5', pos ? 'text-green-400' : 'text-red-400')}>{fmt(tip.close)}</span>
      </span>
      <span className={clsx('mr-3', pos ? 'text-green-400' : 'text-red-400')}>
        {pos ? '+' : ''}{fmt(tip.change)} ({pos ? '+' : ''}{fmt(tip.changePct)}%)
      </span>
      <span className="text-text-muted">Vol:<span className="text-gray-400 ml-0.5">{fmtVol(tip.volume)}</span></span>
    </div>
  );
}

// ─── Indicator Toggle Button ──────────────────────────────────────────────────

function IndicatorBtn({
  label, active, color, disabled, title, onClick,
}: { label: string; active: boolean; color?: string; disabled?: boolean; title?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'px-2 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0 border',
        disabled           && 'opacity-30 cursor-not-allowed',
        active && !color   && 'bg-accent/20 text-accent border-accent/40',
        active &&  color   && 'border-transparent',
        !active            && 'text-text-muted hover:text-gray-300 border-transparent',
      )}
      style={active && color && !disabled
        ? { color, borderColor: `${color}55`, backgroundColor: `${color}18` }
        : undefined}
    >
      {label}
    </button>
  );
}

// ─── Main ProChart Component ──────────────────────────────────────────────────

interface ProChartProps {
  symbol: string;
  initialTimeframe?: Timeframe;
  className?: string;
}

export function ProChart({ symbol, initialTimeframe = '1d', className }: ProChartProps) {
  const prefs = loadPrefs();
  const [timeframe, setTimeframe] = useState<Timeframe>(prefs.timeframe ?? initialTimeframe);
  const [chartType, setChartType] = useState<ChartType>(prefs.chartType ?? 'candle');
  const [indicators, setIndicators] = useState<IndicatorState>({
    ...DEFAULT_INDICATORS,
    ...(prefs.indicators ?? {}),
  });
  const [tooltip, setTooltip] = useState<OHLCTooltip | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertsVersion, setAlertsVersion] = useState(0);
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [drawings, setDrawings] = useState<Drawing[]>(() => loadDrawings(symbol));

  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Line'> | null>(null);
  const volumeRef     = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma100Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMidRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef    = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapRef       = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiRef        = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineRef   = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef   = useRef<ISeriesApi<'Histogram'> | null>(null);
  const alertLinesRef = useRef<IPriceLine[]>([]);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const toolRef       = useRef<DrawingTool>('none');
  const drawingsRef   = useRef<Drawing[]>([]);
  const pendingRef    = useRef<DrawPoint | null>(null);
  const cursorPxRef   = useRef<{ x: number; y: number } | null>(null);
  const barsRef       = useRef<OHLCVBar[]>([]);

  const cfg = TIMEFRAME_CONFIG[timeframe];
  const { data: rawBars = [], isLoading } = useHistory(symbol, cfg.period, cfg.interval);
  const { data: quote } = useQuote(symbol);

  const bars: OHLCVBar[] = timeframe === '4h' ? aggregate4h(rawBars) : rawBars;

  const toggleIndicator = useCallback((key: keyof IndicatorState) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Persist chart preferences (TradingView-style: your setup follows you)
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ timeframe, chartType, indicators } satisfies ChartPrefs));
    } catch { /* storage full — ignore */ }
  }, [timeframe, chartType, indicators]);

  // ── Drawing overlay: re-project (time, price) anchors to pixels ───────────
  const redrawDrawings = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const container = containerRef.current;
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!canvas || !container || !chart || !series) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Map an arbitrary unix time to an x-coordinate via fractional bar index.
    // (timeToCoordinate only resolves exact bar times, which would make
    // drawings vanish after a timeframe switch.)
    const barsNow = barsRef.current;
    const toX = (t: number): number | null => {
      if (!barsNow.length) return null;
      let idx: number;
      const last = barsNow.length - 1;
      if (t <= barsNow[0].time) {
        idx = 0;
      } else if (t >= barsNow[last].time) {
        // Extrapolate past the last bar using the final bar interval
        const step = last > 0 ? barsNow[last].time - barsNow[last - 1].time : 86400;
        idx = last + (step > 0 ? (t - barsNow[last].time) / step : 0);
      } else {
        let lo = 0, hi = last;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (barsNow[mid].time <= t) lo = mid;
          else hi = mid;
        }
        const span = barsNow[hi].time - barsNow[lo].time;
        idx = lo + (span > 0 ? (t - barsNow[lo].time) / span : 0);
      }
      const c = chart.timeScale().logicalToCoordinate(idx as import('lightweight-charts').Logical);
      return c == null ? null : (c as number);
    };
    const toY = (p: number) => {
      const c = series.priceToCoordinate(p);
      return c == null ? null : (c as number);
    };

    const cursor = cursorPxRef.current;
    renderDrawings(
      ctx, w, h, drawingsRef.current, toX, toY,
      pendingRef.current && cursor
        ? { point: pendingRef.current, cursorX: cursor.x, cursorY: cursor.y }
        : null
    );
  }, []);

  // ── Create chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: COLORS.bg },
        textColor: COLORS.text,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: {
        vertLine: { color: COLORS.crosshair, labelBackgroundColor: '#1c1c28' },
        horzLine: { color: COLORS.crosshair, labelBackgroundColor: '#1c1c28' },
      },
      rightPriceScale: { borderColor: '#1a1a28' },
      timeScale: { borderColor: '#1a1a28', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    // ── Volume histogram (bottom pane) ────────────────────────────────────
    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    volumeRef.current = vol;

    // ── Overlay line factory (main price scale) ──────────────────────────
    const makeOverlay = (color: string, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid): ISeriesApi<'Line'> =>
      chart.addLineSeries({
        color,
        lineWidth: width,
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

    sma20Ref.current  = makeOverlay(COLORS.sma20);
    sma50Ref.current  = makeOverlay(COLORS.sma50);
    sma100Ref.current = makeOverlay(COLORS.sma100);
    sma200Ref.current = makeOverlay(COLORS.sma200);
    ema20Ref.current  = makeOverlay(COLORS.ema20);
    ema50Ref.current  = makeOverlay(COLORS.ema50);
    bbUpperRef.current = makeOverlay(COLORS.bb);
    bbMidRef.current   = makeOverlay(COLORS.bbFill, 1, LineStyle.Dotted);
    bbLowerRef.current = makeOverlay(COLORS.bb);
    vwapRef.current    = makeOverlay(COLORS.vwap, 2, LineStyle.Dashed);

    // ── RSI sub-pane ──────────────────────────────────────────────────────
    const rsiSeries = chart.addLineSeries({
      color: COLORS.rsi,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      priceScaleId: 'rsi',
    });
    rsiSeries.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.55)',   lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: '70' });
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(34,197,94,0.55)',   lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: '30' });
    rsiSeries.createPriceLine({ price: 50, color: 'rgba(148,163,184,0.2)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: ''   });
    rsiRef.current = rsiSeries;

    // ── MACD sub-pane (histogram + macd + signal) ─────────────────────────
    macdHistRef.current = chart.addHistogramSeries({
      priceScaleId: 'macd',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    macdLineRef.current = chart.addLineSeries({
      color: COLORS.macd, lineWidth: 1, priceScaleId: 'macd',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    macdSignalRef.current = chart.addLineSeries({
      color: COLORS.macdSignal, lineWidth: 1, priceScaleId: 'macd',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    // ── Drawing tools: click to place anchors on the chart itself ─────────
    const clickHandler = (param: MouseEventParams) => {
      const tool = toolRef.current;
      const series = mainSeriesRef.current;
      if (tool === 'none' || !param.point || !series) return;
      const price = series.coordinateToPrice(param.point.y);
      const time = param.time as unknown as number | undefined;
      if (price == null || time == null) return;

      const pt: DrawPoint = { time, price: price as number };
      const commit = (d: Drawing) => {
        setDrawings((prev) => [...prev, d]);
        pendingRef.current = null;
        setActiveTool('none');
      };

      if (tool === 'hline') {
        commit({ id: crypto.randomUUID(), type: 'hline', points: [pt] });
      } else if (!pendingRef.current) {
        pendingRef.current = pt;
        redrawDrawings();
      } else {
        commit({ id: crypto.randomUUID(), type: tool, points: [pendingRef.current, pt] });
      }
    };
    chart.subscribeClick(clickHandler);

    // Live dashed preview from the first anchor to the cursor
    const previewHandler = (param: MouseEventParams) => {
      if (!pendingRef.current) return;
      if (param.point) cursorPxRef.current = { x: param.point.x, y: param.point.y };
      redrawDrawings();
    };
    chart.subscribeCrosshairMove(previewHandler);

    // Keep drawings glued to bars while panning/zooming
    chart.timeScale().subscribeVisibleLogicalRangeChange(redrawDrawings);

    const ro = new ResizeObserver(redrawDrawings);
    ro.observe(containerRef.current);

    return () => {
      chart.unsubscribeClick(clickHandler);
      chart.unsubscribeCrosshairMove(previewHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(redrawDrawings);
      ro.disconnect();
      chart.remove();
      chartRef.current    = null;
      mainSeriesRef.current = null;
      volumeRef.current   = null;
      sma20Ref.current    = null;
      sma50Ref.current    = null;
      sma100Ref.current   = null;
      sma200Ref.current   = null;
      ema20Ref.current    = null;
      ema50Ref.current    = null;
      bbUpperRef.current  = null;
      bbMidRef.current    = null;
      bbLowerRef.current  = null;
      vwapRef.current     = null;
      rsiRef.current      = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      alertLinesRef.current = [];
    };
  }, []);

  // ── Drawing state sync: refs, persistence, per-symbol reload ──────────────
  useEffect(() => { toolRef.current = activeTool; }, [activeTool]);

  useEffect(() => {
    drawingsRef.current = drawings;
    saveDrawings(symbol, drawings);
    redrawDrawings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings]);

  useEffect(() => {
    pendingRef.current = null;
    setActiveTool('none');
    setDrawings(loadDrawings(symbol));
  }, [symbol]);

  // ── Keyboard shortcuts (desktop): 1-7 timeframes · c/b/l chart types ─────
  // t/h/f drawing tools · Esc cancels the active tool
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'Escape') {
        pendingRef.current = null;
        setActiveTool('none');
        redrawDrawings();
        return;
      }
      const tfIdx = ['1', '2', '3', '4', '5', '6', '7'].indexOf(e.key);
      if (tfIdx >= 0) { setTimeframe(ALL_TIMEFRAMES[tfIdx]); return; }
      if (e.key === 'c') setChartType('candle');
      else if (e.key === 'b') setChartType('bar');
      else if (e.key === 'l') setChartType('line');
      else if (e.key === 't') setActiveTool((p) => (p === 'trend' ? 'none' : 'trend'));
      else if (e.key === 'h') setActiveTool((p) => (p === 'hline' ? 'none' : 'hline'));
      else if (e.key === 'f') setActiveTool((p) => (p === 'fib' ? 'none' : 'fib'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild main series when chartType changes ─────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
      alertLinesRef.current = [];
    }

    if (chartType === 'candle') {
      mainSeriesRef.current = chart.addCandlestickSeries({
        upColor: COLORS.upCandle, downColor: COLORS.downCandle,
        borderUpColor: COLORS.upCandle, borderDownColor: COLORS.downCandle,
        wickUpColor:   COLORS.upCandle, wickDownColor:   COLORS.downCandle,
      });
    } else if (chartType === 'bar') {
      mainSeriesRef.current = chart.addBarSeries({
        upColor: COLORS.upCandle, downColor: COLORS.downCandle,
      });
    } else {
      mainSeriesRef.current = chart.addLineSeries({
        color: '#6366f1', lineWidth: 2, priceLineVisible: false,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  // ── Feed data + update indicators when bars / state change ────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const main  = mainSeriesRef.current;
    if (!chart || !main || !bars.length) return;

    type LCTime = import('lightweight-charts').Time;
    const toTime = (t: number) => t as unknown as LCTime;
    const pts = (arr: Point[]) => arr.map((p) => ({ time: toTime(p.time), value: p.value }));

    // Main series
    const tvBars = bars.map((b) => ({ time: toTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close }));
    const tvLine = bars.map((b) => ({ time: toTime(b.time), value: b.close }));

    if (chartType === 'candle' || chartType === 'bar') {
      (main as ISeriesApi<'Candlestick'>).setData(tvBars);
    } else {
      (main as ISeriesApi<'Line'>).setData(tvLine);
    }

    // Volume
    if (volumeRef.current) {
      volumeRef.current.setData(
        indicators.volume
          ? bars.map((b) => ({
              time:  toTime(b.time),
              value: b.volume,
              color: b.close >= b.open ? COLORS.volume.up : COLORS.volume.down,
            }))
          : []
      );
    }

    // Moving-average overlays
    const feed = (s: ISeriesApi<'Line'> | null, on: boolean, data: () => Point[]) => {
      if (!s) return;
      s.setData(on ? pts(data()) : []);
    };
    feed(sma20Ref.current,  indicators.sma20,  () => calculateSMA(bars, 20));
    feed(sma50Ref.current,  indicators.sma50,  () => calculateSMA(bars, 50));
    feed(sma100Ref.current, indicators.sma100, () => calculateSMA(bars, 100));
    feed(sma200Ref.current, indicators.sma200, () => calculateSMA(bars, 200));
    feed(ema20Ref.current,  indicators.ema20,  () => calculateEMA(bars, 20));
    feed(ema50Ref.current,  indicators.ema50,  () => calculateEMA(bars, 50));

    // Bollinger Bands
    if (indicators.bb) {
      const bb = calculateBollinger(bars);
      bbUpperRef.current?.setData(pts(bb.upper));
      bbMidRef.current?.setData(pts(bb.mid));
      bbLowerRef.current?.setData(pts(bb.lower));
    } else {
      bbUpperRef.current?.setData([]);
      bbMidRef.current?.setData([]);
      bbLowerRef.current?.setData([]);
    }

    // VWAP (intraday only)
    feed(vwapRef.current, indicators.vwap && cfg.isIntraday, () => calculateVWAP(bars));

    // RSI pane
    if (rsiRef.current) {
      rsiRef.current.setData(indicators.rsi ? pts(rsiPoints(bars)) : []);
    }

    // MACD pane
    if (indicators.macd) {
      const m = calculateMACD(bars);
      macdLineRef.current?.setData(pts(m.macd));
      macdSignalRef.current?.setData(pts(m.signal));
      macdHistRef.current?.setData(
        m.hist.map((p) => ({
          time: toTime(p.time),
          value: p.value,
          color: p.value >= 0 ? COLORS.macdHistUp : COLORS.macdHistDown,
        }))
      );
    } else {
      macdLineRef.current?.setData([]);
      macdSignalRef.current?.setData([]);
      macdHistRef.current?.setData([]);
    }

    // Dynamic pane layout
    const m = paneMargins(indicators);
    chart.priceScale('right').applyOptions({ scaleMargins: m.main });
    chart.priceScale('rsi').applyOptions({ scaleMargins: m.rsi });
    chart.priceScale('macd').applyOptions({ scaleMargins: m.macd });
    chart.priceScale('vol').applyOptions({ scaleMargins: m.vol });

    barsRef.current = bars;
    chart.timeScale().fitContent();
    redrawDrawings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, indicators, chartType, cfg.isIntraday]);

  // ── Alert price lines (drawn on the chart, TradingView-style) ─────────────
  useEffect(() => {
    const main = mainSeriesRef.current;
    if (!main) return;

    // Clear previous lines
    for (const line of alertLinesRef.current) {
      try { main.removePriceLine(line); } catch { /* series rebuilt */ }
    }
    alertLinesRef.current = [];

    const active = loadAlerts().filter((a) => a.symbol === symbol && !a.triggered);
    for (const a of active) {
      const line = main.createPriceLine({
        price: a.targetPrice,
        color: COLORS.alertLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `🔔 ${a.direction === 'above' ? '≥' : '≤'} ${a.targetPrice}`,
      });
      alertLinesRef.current.push(line);
    }
  }, [symbol, alertsVersion, chartType, bars.length]);

  // ── Crosshair tooltip ─────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handler = (param: MouseEventParams) => {
      if (!param.time || !mainSeriesRef.current) { setTooltipVisible(false); return; }
      const raw = param.seriesData.get(mainSeriesRef.current);
      if (!raw) { setTooltipVisible(false); return; }

      let o: number, h: number, l: number, c: number;
      if ('open' in raw)       { o = raw.open; h = raw.high; l = raw.low; c = raw.close; }
      else if ('value' in raw) { o = raw.value; h = raw.value; l = raw.value; c = raw.value; }
      else { setTooltipVisible(false); return; }

      const barIdx = bars.findIndex((b) => b.time === (param.time as unknown as number));
      const prev   = barIdx > 0 ? bars[barIdx - 1].close : o;
      const change = c - prev;

      const d = new Date((param.time as unknown as number) * 1000);
      const timeStr = cfg.isIntraday
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      setTooltip({
        time: timeStr, open: o, high: h, low: l, close: c,
        volume: bars[barIdx]?.volume ?? 0,
        change, changePct: prev > 0 ? (change / prev) * 100 : 0,
      });
      setTooltipVisible(true);
    };

    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [bars, cfg.isIntraday]);

  // ── Earnings markers ──────────────────────────────────────────────────────
  const { data: earningsDates } = useEarnings(symbol);

  useEffect(() => {
    const main = mainSeriesRef.current;
    if (!main || !bars.length) return;

    if (!earningsDates?.length) {
      (main as ISeriesApi<'Candlestick'>).setMarkers([]);
      return;
    }

    const earningsSet = new Set(earningsDates.map((e) => e.date));
    const today = new Date().toISOString().slice(0, 10);

    const markers = bars
      .filter((b) => earningsSet.has(new Date(b.time * 1000).toISOString().slice(0, 10)))
      .map((b) => {
        const day = new Date(b.time * 1000).toISOString().slice(0, 10);
        const ed  = earningsDates.find((e) => e.date === day)!;
        const upcoming = day >= today;
        const pos      = ed.surprise != null && ed.surprise >= 0;
        return {
          time:     b.time as unknown as import('lightweight-charts').Time,
          position: 'belowBar' as const,
          color:    upcoming ? '#f59e0b' : pos ? '#22c55e' : '#ef4444',
          shape:    'arrowUp' as const,
          text:     upcoming ? 'E' : ed.surprise != null ? `E ${pos ? '+' : ''}${ed.surprise.toFixed(1)}%` : 'E',
          size:     1,
        };
      });

    (main as ISeriesApi<'Candlestick'>).setMarkers(markers);
  }, [earningsDates, bars]);

  // ── Screenshot (chart canvas → PNG download) ──────────────────────────────
  const takeScreenshot = useCallback(async () => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const canvas = chart.takeScreenshot();
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${symbol}-${timeframe}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (e) {
      console.warn('[ProChart] screenshot failed:', e);
    }
  }, [symbol, timeframe]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const TIMEFRAMES: Timeframe[] = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  const TF_LABELS: Record<Timeframe, string> = { '5m': '5M', '15m': '15M', '30m': '30M', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W' };
  const isPos = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className={clsx('flex flex-col min-h-0 bg-bg-primary select-none', className)}>

      {/* ── Top bar: symbol info + chart type + timeframes + indicators ── */}
      <div className="flex items-center gap-2 px-2 h-9 border-b border-panel bg-bg-secondary shrink-0 overflow-x-auto no-scrollbar">

        {/* Price summary */}
        {quote && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-white">{symbol}</span>
            <span className="text-xs font-mono text-white">{fmt(quote.price)}</span>
            <span className={clsx('text-[10px] font-mono', isPos ? 'text-green-400' : 'text-red-400')}>
              {isPos ? '+' : ''}{fmt(quote.changePercent)}%
            </span>
          </div>
        )}

        <div className="w-px h-4 bg-panel shrink-0" />

        {/* Chart type */}
        {(['candle', 'bar', 'line'] as ChartType[]).map((t) => (
          <button
            key={t}
            onClick={() => setChartType(t)}
            className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] capitalize transition-colors shrink-0',
              chartType === t ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-300'
            )}
          >
            {t}
          </button>
        ))}

        <div className="w-px h-4 bg-panel shrink-0" />

        {/* Timeframes */}
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={clsx(
              'px-2 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0',
              timeframe === tf ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-300'
            )}
          >
            {TF_LABELS[tf]}
          </button>
        ))}

        <div className="w-px h-4 bg-panel shrink-0" />

        {/* Overlays */}
        <IndicatorBtn label="SMA20"  active={indicators.sma20}  color={COLORS.sma20}  onClick={() => toggleIndicator('sma20')} />
        <IndicatorBtn label="SMA50"  active={indicators.sma50}  color={COLORS.sma50}  onClick={() => toggleIndicator('sma50')} />
        <IndicatorBtn label="SMA100" active={indicators.sma100} color={COLORS.sma100} onClick={() => toggleIndicator('sma100')} />
        <IndicatorBtn label="SMA200" active={indicators.sma200} color={COLORS.sma200} onClick={() => toggleIndicator('sma200')} />
        <IndicatorBtn label="EMA20"  active={indicators.ema20}  color={COLORS.ema20}  onClick={() => toggleIndicator('ema20')} />
        <IndicatorBtn label="EMA50"  active={indicators.ema50}  color={COLORS.ema50}  onClick={() => toggleIndicator('ema50')} />
        <IndicatorBtn label="BB"     active={indicators.bb}     color="#60a5fa"       onClick={() => toggleIndicator('bb')} />
        <IndicatorBtn
          label="VWAP"
          active={indicators.vwap && cfg.isIntraday}
          color={COLORS.vwap}
          disabled={!cfg.isIntraday}
          title={cfg.isIntraday ? 'Volume-weighted average price (session)' : 'VWAP is intraday-only'}
          onClick={() => toggleIndicator('vwap')}
        />

        <div className="w-px h-4 bg-panel shrink-0" />

        {/* Panes */}
        <IndicatorBtn label="VOL"  active={indicators.volume}                          onClick={() => toggleIndicator('volume')} />
        <IndicatorBtn label="RSI"  active={indicators.rsi}    color={COLORS.rsi}      onClick={() => toggleIndicator('rsi')} />
        <IndicatorBtn label="MACD" active={indicators.macd}   color={COLORS.macd}     onClick={() => toggleIndicator('macd')} />

        <div className="w-px h-4 bg-panel shrink-0" />

        {/* Drawing tools */}
        <button
          onClick={() => setActiveTool((p) => (p === 'trend' ? 'none' : 'trend'))}
          title="Trendline — click two points (T)"
          className={clsx('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors shrink-0',
            activeTool === 'trend' ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-300')}
        >
          <PenLine className="w-3 h-3" />Trend
        </button>
        <button
          onClick={() => setActiveTool((p) => (p === 'hline' ? 'none' : 'hline'))}
          title="Horizontal level — click a price (H)"
          className={clsx('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors shrink-0',
            activeTool === 'hline' ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-300')}
        >
          <Minus className="w-3 h-3" />Level
        </button>
        <button
          onClick={() => setActiveTool((p) => (p === 'fib' ? 'none' : 'fib'))}
          title="Fibonacci retracement — click high then low (F)"
          className={clsx('px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0',
            activeTool === 'fib' ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-300')}
        >
          Fib
        </button>
        {drawings.length > 0 && (
          <>
            <button
              onClick={() => setDrawings((prev) => prev.slice(0, -1))}
              title="Undo last drawing"
              className="px-1 py-0.5 rounded text-text-muted hover:text-white transition-colors shrink-0"
            >
              <Undo2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setDrawings([])}
              title="Clear all drawings"
              className="px-1 py-0.5 rounded text-text-muted hover:text-red-400 transition-colors shrink-0"
            >
              <Eraser className="w-3 h-3" />
            </button>
          </>
        )}

        <div className="w-px h-4 bg-panel shrink-0" />

        {/* Actions */}
        <button
          onClick={() => setShowAlertModal(true)}
          title="Create price alert (drawn on chart)"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-gold transition-colors shrink-0"
        >
          <Bell className="w-3 h-3" />Alert
        </button>
        <button
          onClick={takeScreenshot}
          title="Save chart as PNG"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-white transition-colors shrink-0"
        >
          <Camera className="w-3 h-3" />
        </button>
      </div>

      {/* ── Chart canvas ── */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-primary/70">
            <div className="w-5 h-5 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
          </div>
        )}
        <Tooltip tip={tooltip} visible={tooltipVisible} />
        {activeTool !== 'none' && (
          <div className="absolute top-1 right-2 z-10 bg-accent/90 text-white rounded px-2 py-0.5 text-[10px] pointer-events-none select-none">
            {activeTool === 'hline' ? 'Click a price level' : activeTool === 'fib' ? 'Click the high, then the low' : 'Click two points'} · Esc to cancel
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
        <canvas ref={drawCanvasRef} className="absolute inset-0 z-[5] pointer-events-none" />
      </div>

      {showAlertModal && (
        <AddAlertModal
          defaultSymbol={symbol}
          onClose={() => setShowAlertModal(false)}
          onAdded={() => setAlertsVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}

// ─── RSI helper (kept close to original implementation) ─────────────────────

function rsiPoints(bars: OHLCVBar[], period = 14): Point[] {
  if (bars.length < period + 1) return [];
  const result: Point[] = [];

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff > 0) avgGain += diff;
    else          avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({ time: bars[period].time, value: 100 - 100 / (1 + firstRS) });

  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: bars[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}
