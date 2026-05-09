import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
} from 'lightweight-charts';
import clsx from 'clsx';
import type { OHLCVBar } from '../../types';
import { useHistory } from '../../hooks/useHistory';
import { useQuote } from '../../hooks/useQuotes';
import { useEarnings } from '../../hooks/useEarnings';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Timeframe = '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
type ChartType = 'candle' | 'bar' | 'line';

interface IndicatorState {
  sma20:  boolean;
  sma50:  boolean;
  sma100: boolean;
  sma200: boolean;
  volume: boolean;
  rsi:    boolean;
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
  rsi:    '#a78bfa',   // purple
};

// Main-chart bottom margin varies with RSI sub-panel
const MARGINS_RSI_ON  = { top: 0.08, bottom: 0.42 } as const;
const MARGINS_RSI_OFF = { top: 0.08, bottom: 0.22 } as const;

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

// ─── Utility: Simple Moving Average (rolling sum, O(n)) ──────────────────────

function calculateSMA(bars: OHLCVBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period) return [];
  const result: { time: number; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  result.push({ time: bars[period - 1].time, value: sum / period });
  for (let i = period; i < bars.length; i++) {
    sum += bars[i].close - bars[i - period].close;
    result.push({ time: bars[i].time, value: sum / period });
  }
  return result;
}

// ─── Utility: RSI-14 (Wilder's smoothed method) ───────────────────────────────

function calculateRSI(bars: OHLCVBar[], period = 14): { time: number; value: number }[] {
  if (bars.length < period + 1) return [];
  const result: { time: number; value: number }[] = [];

  // Seed with simple averages over the first `period` changes
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

  // Wilder smoothing for subsequent bars
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
  label, active, color, onClick,
}: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0 border',
        active && !color && 'bg-accent/20 text-accent border-accent/40',
        active &&  color && 'border-transparent',
        !active           && 'text-text-muted hover:text-gray-300 border-transparent',
      )}
      style={active && color
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
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [indicators, setIndicators] = useState<IndicatorState>({
    sma20: true, sma50: true, sma100: true, sma200: true, volume: true, rsi: true,
  });
  const [tooltip, setTooltip] = useState<OHLCTooltip | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Line'> | null>(null);
  const volumeRef     = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref      = useRef<ISeriesApi<'Line'> | null>(null);
  const sma100Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200Ref     = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiRef        = useRef<ISeriesApi<'Line'> | null>(null);

  const cfg = TIMEFRAME_CONFIG[timeframe];
  const { data: rawBars = [], isLoading } = useHistory(symbol, cfg.period, cfg.interval);
  const { data: quote } = useQuote(symbol);

  const bars: OHLCVBar[] = timeframe === '4h' ? aggregate4h(rawBars) : rawBars;

  const toggleIndicator = useCallback((key: keyof IndicatorState) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
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
      // Default margins assume RSI is on (matches initial indicator state)
      rightPriceScale: { borderColor: '#1a1a28', scaleMargins: MARGINS_RSI_ON },
      timeScale: { borderColor: '#1a1a28', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    // ── Volume histogram (bottom ~15%) ────────────────────────────────────
    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeRef.current = vol;

    // ── SMA overlays (main price scale) ──────────────────────────────────
    const makeSMA = (color: string): ISeriesApi<'Line'> =>
      chart.addLineSeries({
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

    sma20Ref.current  = makeSMA(COLORS.sma20);
    sma50Ref.current  = makeSMA(COLORS.sma50);
    sma100Ref.current = makeSMA(COLORS.sma100);
    sma200Ref.current = makeSMA(COLORS.sma200);

    // ── RSI sub-panel (middle ~18%, between main and volume) ───────────
    const rsiSeries = chart.addLineSeries({
      color: COLORS.rsi,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      priceScaleId: 'rsi',
    });
    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.63, bottom: 0.18 },
    });
    // Overbought / oversold / midline reference lines
    rsiSeries.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.55)',   lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: '70' });
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(34,197,94,0.55)',   lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: '30' });
    rsiSeries.createPriceLine({ price: 50, color: 'rgba(148,163,184,0.2)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: ''   });
    rsiRef.current = rsiSeries;

    return () => {
      chart.remove();
      chartRef.current    = null;
      mainSeriesRef.current = null;
      volumeRef.current   = null;
      sma20Ref.current    = null;
      sma50Ref.current    = null;
      sma100Ref.current   = null;
      sma200Ref.current   = null;
      rsiRef.current      = null;
    };
  }, []);

  // ── Rebuild main series when chartType changes ─────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
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

    // SMA helper
    const feedSMA = (s: ISeriesApi<'Line'> | null, on: boolean, period: number) => {
      if (!s) return;
      s.setData(
        on
          ? calculateSMA(bars, period).map((p) => ({ time: toTime(p.time), value: p.value }))
          : []
      );
    };
    feedSMA(sma20Ref.current,  indicators.sma20,  20);
    feedSMA(sma50Ref.current,  indicators.sma50,  50);
    feedSMA(sma100Ref.current, indicators.sma100, 100);
    feedSMA(sma200Ref.current, indicators.sma200, 200);

    // RSI + dynamic main-chart bottom margin
    if (rsiRef.current) {
      rsiRef.current.setData(
        indicators.rsi
          ? calculateRSI(bars).map((p) => ({ time: toTime(p.time), value: p.value }))
          : []
      );
      chart.priceScale('right').applyOptions({
        scaleMargins: indicators.rsi ? MARGINS_RSI_ON : MARGINS_RSI_OFF,
      });
    }

    chart.timeScale().fitContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, indicators, chartType]);

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

        {/* SMA toggles — each button uses the SMA's own colour when active */}
        <IndicatorBtn label="SMA20"  active={indicators.sma20}  color={COLORS.sma20}  onClick={() => toggleIndicator('sma20')} />
        <IndicatorBtn label="SMA50"  active={indicators.sma50}  color={COLORS.sma50}  onClick={() => toggleIndicator('sma50')} />
        <IndicatorBtn label="SMA100" active={indicators.sma100} color={COLORS.sma100} onClick={() => toggleIndicator('sma100')} />
        <IndicatorBtn label="SMA200" active={indicators.sma200} color={COLORS.sma200} onClick={() => toggleIndicator('sma200')} />
        <IndicatorBtn label="VOL"    active={indicators.volume}                        onClick={() => toggleIndicator('volume')} />
        <IndicatorBtn label="RSI"    active={indicators.rsi}    color={COLORS.rsi}    onClick={() => toggleIndicator('rsi')} />
      </div>

      {/* ── Chart canvas ── */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-primary/70">
            <div className="w-5 h-5 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
          </div>
        )}
        <Tooltip tip={tooltip} visible={tooltipVisible} />
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
