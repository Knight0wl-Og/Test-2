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

// ─── Types ───────────────────────────────────────────────────────────────────

export type Timeframe = '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
type ChartType = 'candle' | 'bar' | 'line';

interface IndicatorState {
  vwap: boolean;
  pdhl: boolean;   // Previous Day H/L/C
  pivots: boolean;
  ob: boolean;     // Order Blocks
  fvg: boolean;    // Fair Value Gaps
  volume: boolean;
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
  '5m':  { period: '3mo',  interval: '5m',  isIntraday: true  },
  '15m': { period: '3mo',  interval: '15m', isIntraday: true  },
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
  vwap: '#f59e0b',
  pdh: '#22c55e',
  pdl: '#ef4444',
  pdc: '#94a3b8',
  pp: '#a78bfa',
  pivot: '#6366f1',
  obBull: '#22c55e',
  obBear: '#ef4444',
  fvgBull: 'rgba(34,197,94,0.15)',
  fvgBear: 'rgba(239,68,68,0.15)',
};

// ─── Utility: 4H aggregation ─────────────────────────────────────────────────

function aggregate4h(bars: OHLCVBar[]): OHLCVBar[] {
  const buckets = new Map<number, OHLCVBar[]>();
  for (const bar of bars) {
    // Snap to 4-hour UTC bucket
    const snap = bar.time - (bar.time % (4 * 3600));
    if (!buckets.has(snap)) buckets.set(snap, []);
    buckets.get(snap)!.push(bar);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, grp]) => ({
      time,
      open: grp[0].open,
      high: Math.max(...grp.map((b) => b.high)),
      low: Math.min(...grp.map((b) => b.low)),
      close: grp[grp.length - 1].close,
      volume: grp.reduce((s, b) => s + b.volume, 0),
    }));
}

// ─── Utility: VWAP (resets each trading day) ─────────────────────────────────

function calculateVWAP(bars: OHLCVBar[]): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  let cumTPV = 0;
  let cumVol = 0;
  let currentDay = '';
  for (const bar of bars) {
    const day = new Date(bar.time * 1000).toISOString().slice(0, 10);
    if (day !== currentDay) { cumTPV = 0; cumVol = 0; currentDay = day; }
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumTPV += tp * bar.volume;
    cumVol += bar.volume;
    result.push({ time: bar.time, value: cumVol > 0 ? cumTPV / cumVol : bar.close });
  }
  return result;
}

// ─── Utility: Previous Day H/L/C ─────────────────────────────────────────────

function getPrevDayHLC(bars: OHLCVBar[]): { high: number; low: number; close: number } | null {
  if (!bars.length) return null;
  const byDate = new Map<string, OHLCVBar[]>();
  for (const b of bars) {
    const d = new Date(b.time * 1000).toISOString().slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(b);
  }
  const dates = Array.from(byDate.keys()).sort();
  const todayStr = new Date().toISOString().slice(0, 10);
  const prev = dates.filter((d) => d < todayStr).at(-1) ?? dates.at(-2);
  if (!prev) return null;
  const g = byDate.get(prev)!;
  return { high: Math.max(...g.map((b) => b.high)), low: Math.min(...g.map((b) => b.low)), close: g.at(-1)!.close };
}

// ─── Utility: Pivot Points ────────────────────────────────────────────────────

function calcPivots(h: number, l: number, c: number) {
  const pp = (h + l + c) / 3;
  return { pp, r1: 2 * pp - l, r2: pp + (h - l), s1: 2 * pp - h, s2: pp - (h - l) };
}

// ─── Utility: Order Blocks ────────────────────────────────────────────────────

function findOrderBlocks(bars: OHLCVBar[], limit = 4) {
  const obs: { time: number; high: number; low: number; type: 'bull' | 'bear' }[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    const curr = bars[i];
    const next = bars[i + 1];
    const currBody = Math.abs(curr.close - curr.open);
    const nextBody = Math.abs(next.close - next.open);
    if (currBody < 0.001) continue;
    if (curr.close < curr.open && next.close > next.open && nextBody > currBody * 1.5)
      obs.push({ time: curr.time, high: curr.high, low: curr.low, type: 'bull' });
    if (curr.close > curr.open && next.close < next.open && nextBody > currBody * 1.5)
      obs.push({ time: curr.time, high: curr.high, low: curr.low, type: 'bear' });
  }
  return obs.slice(-limit);
}

// ─── Utility: Fair Value Gaps ─────────────────────────────────────────────────

function findFVGs(bars: OHLCVBar[], limit = 5) {
  const fvgs: { time: number; top: number; bottom: number; type: 'bull' | 'bear' }[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    const prev = bars[i - 1];
    const next = bars[i + 1];
    if (next.low > prev.high && next.low - prev.high > 0.01)
      fvgs.push({ time: bars[i].time, top: next.low, bottom: prev.high, type: 'bull' });
    if (next.high < prev.low && prev.low - next.high > 0.01)
      fvgs.push({ time: bars[i].time, top: prev.low, bottom: next.high, type: 'bear' });
  }
  return fvgs.slice(-limit);
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

function IndicatorBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2 py-0.5 rounded text-[10px] font-mono transition-colors shrink-0',
        active ? 'bg-accent/20 text-accent border border-accent/40' : 'text-text-muted hover:text-gray-300 border border-transparent'
      )}
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
    vwap: true, pdhl: true, pivots: true, ob: true, fvg: true, volume: true,
  });
  const [tooltip, setTooltip] = useState<OHLCTooltip | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const overlayLinesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([]);

  const cfg = TIMEFRAME_CONFIG[timeframe];
  const { data: rawBars = [], isLoading } = useHistory(symbol, cfg.period, cfg.interval);
  const { data: quote } = useQuote(symbol);

  // Aggregate 4H from 1H raw data
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
      rightPriceScale: { borderColor: '#1a1a28', scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: '#1a1a28', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    // Volume series (always created, shown/hidden via data)
    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeriesRef.current = vol;

    return () => {
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      vwapSeriesRef.current = null;
      overlayLinesRef.current = [];
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
    if (vwapSeriesRef.current) {
      chart.removeSeries(vwapSeriesRef.current);
      vwapSeriesRef.current = null;
    }
    overlayLinesRef.current = [];

    if (chartType === 'candle') {
      mainSeriesRef.current = chart.addCandlestickSeries({
        upColor: COLORS.upCandle, downColor: COLORS.downCandle,
        borderUpColor: COLORS.upCandle, borderDownColor: COLORS.downCandle,
        wickUpColor: COLORS.upCandle, wickDownColor: COLORS.downCandle,
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

    // VWAP line series (always created; data set conditionally)
    vwapSeriesRef.current = chart.addLineSeries({
      color: COLORS.vwap, lineWidth: 1, lineStyle: LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  // ── Feed data and overlays when bars/indicators change ────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainSeriesRef.current;
    const vol = volumeSeriesRef.current;
    const vwapSeries = vwapSeriesRef.current;
    if (!chart || !main || !bars.length) return;

    // Clear old price lines
    overlayLinesRef.current.forEach((pl) => {
      try { (main as ISeriesApi<'Candlestick'>).removePriceLine(pl); } catch { /* already removed */ }
    });
    overlayLinesRef.current = [];

    const tvBars = bars.map((b) => ({ time: b.time as unknown as import('lightweight-charts').Time, open: b.open, high: b.high, low: b.low, close: b.close }));
    const tvLine = bars.map((b) => ({ time: b.time as unknown as import('lightweight-charts').Time, value: b.close }));

    if (chartType === 'candle' || chartType === 'bar') {
      (main as ISeriesApi<'Candlestick'>).setData(tvBars);
    } else {
      (main as ISeriesApi<'Line'>).setData(tvLine);
    }

    // Volume
    if (vol) {
      vol.setData(
        indicators.volume
          ? bars.map((b) => ({
              time: b.time as unknown as import('lightweight-charts').Time,
              value: b.volume,
              color: b.close >= b.open ? COLORS.volume.up : COLORS.volume.down,
            }))
          : []
      );
    }

    // VWAP
    if (vwapSeries) {
      if (indicators.vwap && cfg.isIntraday) {
        const vd = calculateVWAP(bars);
        vwapSeries.setData(vd.map((v) => ({ time: v.time as unknown as import('lightweight-charts').Time, value: v.value })));
      } else {
        vwapSeries.setData([]);
      }
    }

    const addLine = (price: number, color: string, title: string, style: LineStyle = LineStyle.Dashed) => {
      const pl = (main as ISeriesApi<'Candlestick'>).createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
      overlayLinesRef.current.push(pl);
    };

    // Previous Day H/L/C
    const pd = getPrevDayHLC(bars);
    if (indicators.pdhl && pd) {
      addLine(pd.high, COLORS.pdh, 'PDH', LineStyle.Dashed);
      addLine(pd.low, COLORS.pdl, 'PDL', LineStyle.Dashed);
      addLine(pd.close, COLORS.pdc, 'PDC', LineStyle.Dotted);

      // Pivot Points
      if (indicators.pivots) {
        const { pp, r1, r2, s1, s2 } = calcPivots(pd.high, pd.low, pd.close);
        addLine(pp, COLORS.pp, 'PP', LineStyle.Solid);
        addLine(r1, COLORS.pivot, 'R1', LineStyle.Dashed);
        addLine(r2, COLORS.pivot, 'R2', LineStyle.Dashed);
        addLine(s1, COLORS.pivot, 'S1', LineStyle.Dashed);
        addLine(s2, COLORS.pivot, 'S2', LineStyle.Dashed);
      }
    }

    // Order Blocks (top + bottom lines)
    if (indicators.ob) {
      findOrderBlocks(bars).forEach(({ high, low, type }) => {
        const color = type === 'bull' ? COLORS.obBull : COLORS.obBear;
        addLine(high, color, type === 'bull' ? 'OB▲' : 'OB▼', LineStyle.Solid);
        addLine(low, color, '', LineStyle.Dotted);
      });
    }

    // Fair Value Gaps (top + bottom lines)
    if (indicators.fvg) {
      findFVGs(bars).forEach(({ top, bottom, type }) => {
        const color = type === 'bull' ? '#22c55e' : '#ef4444';
        addLine(top, color, type === 'bull' ? 'FVG▲' : 'FVG▼', LineStyle.LargeDashed);
        addLine(bottom, color, '', LineStyle.LargeDashed);
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
      if (!param.time || !mainSeriesRef.current) {
        setTooltipVisible(false);
        return;
      }
      const raw = param.seriesData.get(mainSeriesRef.current);
      if (!raw) { setTooltipVisible(false); return; }

      let o: number, h: number, l: number, c: number;
      if ('open' in raw) { o = raw.open; h = raw.high; l = raw.low; c = raw.close; }
      else if ('value' in raw) { o = raw.value; h = raw.value; l = raw.value; c = raw.value; }
      else { setTooltipVisible(false); return; }

      const barIdx = bars.findIndex((b) => b.time === (param.time as unknown as number));
      const prev = barIdx > 0 ? bars[barIdx - 1].close : o;
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

  // ─── Render ────────────────────────────────────────────────────────────────

  const TIMEFRAMES: Timeframe[] = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  const TF_LABELS: Record<Timeframe, string> = { '5m': '5M', '15m': '15M', '30m': '30M', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W' };

  const isPos = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className={clsx('flex flex-col min-h-0 bg-bg-primary select-none', className)}>

      {/* ── Top bar: symbol info + chart type + timeframes ── */}
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

        {/* Indicator toggles */}
        <IndicatorBtn label="VWAP" active={indicators.vwap} onClick={() => toggleIndicator('vwap')} />
        <IndicatorBtn label="PDH/L" active={indicators.pdhl} onClick={() => toggleIndicator('pdhl')} />
        <IndicatorBtn label="PVTS" active={indicators.pivots} onClick={() => toggleIndicator('pivots')} />
        <IndicatorBtn label="OB" active={indicators.ob} onClick={() => toggleIndicator('ob')} />
        <IndicatorBtn label="FVG" active={indicators.fvg} onClick={() => toggleIndicator('fvg')} />
        <IndicatorBtn label="VOL" active={indicators.volume} onClick={() => toggleIndicator('volume')} />
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
