import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickSeriesOptions,
  type LineSeriesOptions,
  type AreaSeriesOptions,
} from 'lightweight-charts';
import clsx from 'clsx';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';
import { useQuote } from '../../hooks/useQuotes';
import type { ChartType } from '../../types';

type Timeframe = '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

const TIMEFRAMES: Timeframe[] = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'];

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '5m': '5M', '15m': '15M', '30m': '30M', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W',
};

const TIMEFRAME_CONFIG: Record<Timeframe, { period: string; interval: string }> = {
  '5m':  { period: '1d',  interval: '5m'   },
  '15m': { period: '5d',  interval: '15m'  },
  '30m': { period: '1mo', interval: '30m'  },
  '1h':  { period: '3mo', interval: '60m'  },
  '4h':  { period: '6mo', interval: '1h'   },
  '1d':  { period: '1y',  interval: '1d'   },
  '1w':  { period: '5y',  interval: '1wk'  },
};

function fmtLarge(n: number | null) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString();
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface PriceChartProps {
  symbol: string;
}

function ChartCanvas({
  symbol, chartType, timeframe, fullscreen,
}: {
  symbol: string;
  chartType: ChartType;
  timeframe: Timeframe;
  fullscreen: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const { data: ohlcv, isLoading } = useHistory(
    symbol,
    TIMEFRAME_CONFIG[timeframe].period,
    TIMEFRAME_CONFIG[timeframe].interval,
  );

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0a0f' },
        textColor: '#9ca3af',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a28' },
        horzLines: { color: '#1a1a28' },
      },
      crosshair: {
        vertLine: { color: '#374151', labelBackgroundColor: '#1c1c28' },
        horzLine: { color: '#374151', labelBackgroundColor: '#1c1c28' },
      },
      rightPriceScale: { borderColor: '#1f2937' },
      timeScale: { borderColor: '#1f2937', timeVisible: true },
      width: containerRef.current.clientWidth,
      height: fullscreen ? window.innerHeight - 120 : 340,
    });

    chartRef.current = chart;

    // Volume histogram (underneath)
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeRef.current = volSeries;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: fullscreen ? window.innerHeight - 120 : 340,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // Update series when chartType changes
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (chartType === 'candlestick') {
      seriesRef.current = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      } as Partial<CandlestickSeriesOptions>);
    } else if (chartType === 'line') {
      seriesRef.current = chart.addLineSeries({
        color: '#6366f1',
        lineWidth: 2,
      } as Partial<LineSeriesOptions>);
    } else {
      seriesRef.current = chart.addAreaSeries({
        topColor: 'rgba(99, 102, 241, 0.4)',
        bottomColor: 'rgba(99, 102, 241, 0.0)',
        lineColor: '#6366f1',
        lineWidth: 2,
      } as Partial<AreaSeriesOptions>);
    }
  }, [chartType, fullscreen]);

  // Feed data
  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current || !ohlcv?.length) return;

    if (chartType === 'candlestick') {
      (seriesRef.current as ISeriesApi<'Candlestick'>).setData(
        ohlcv.map((b) => ({
          time: b.time as unknown as import('lightweight-charts').Time,
          open: b.open, high: b.high, low: b.low, close: b.close,
        }))
      );
    } else {
      (seriesRef.current as ISeriesApi<'Line'> | ISeriesApi<'Area'>).setData(
        ohlcv.map((b) => ({
          time: b.time as unknown as import('lightweight-charts').Time,
          value: b.close,
        }))
      );
    }

    volumeRef.current.setData(
      ohlcv.map((b) => ({
        time: b.time as unknown as import('lightweight-charts').Time,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
      }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [ohlcv, chartType]);

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-bg-card/80 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

export function PriceChart({ symbol }: PriceChartProps) {
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [fullscreen, setFullscreen] = useState(false);

  const { data: quote } = useQuote(symbol);

  const isPos = (quote?.changePercent ?? 0) >= 0;

  const header = (
    <div className="px-4 pt-4 pb-3 border-b border-border-dim space-y-2">
      {/* Price info */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-lg font-bold text-white">{symbol}</span>
            {quote && (
              <>
                <span className="text-2xl font-bold num text-white">{fmt(quote.price)}</span>
                <span className={clsx('text-sm font-semibold num', isPos ? 'text-green' : 'text-red')}>
                  {isPos ? '+' : ''}{fmt(quote.change)} ({isPos ? '+' : ''}{fmt(quote.changePercent)}%)
                </span>
              </>
            )}
          </div>
          {quote && (
            <div className="flex gap-4 mt-1 text-xs text-text-muted flex-wrap">
              <span>O: <span className="text-gray-300 num">{fmt(quote.open)}</span></span>
              <span>H: <span className="text-gray-300 num">{fmt(quote.high)}</span></span>
              <span>L: <span className="text-gray-300 num">{fmt(quote.low)}</span></span>
              <span>PC: <span className="text-gray-300 num">{fmt(quote.previousClose)}</span></span>
              {quote.marketCap && (
                <span>MCap: <span className="text-gray-300">{fmtLarge(quote.marketCap)}</span></span>
              )}
            </div>
          )}
        </div>
        {/* Fullscreen toggle */}
        <button
          onClick={() => setFullscreen((f) => !f)}
          className="text-text-muted hover:text-gray-200 transition-colors shrink-0 p-1"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Controls row — scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {/* Chart type toggle */}
        <div className="flex bg-bg-hover rounded overflow-hidden text-xs shrink-0">
          {(['candlestick', 'line', 'area'] as ChartType[]).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={clsx(
                'px-2.5 py-1.5 capitalize transition-colors',
                chartType === t ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-200'
              )}
            >
              {t === 'candlestick' ? 'Candle' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border-dim shrink-0" />

        {/* Timeframe selector */}
        <div className="flex bg-bg-hover rounded overflow-hidden text-xs shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={clsx(
                'px-2.5 py-1.5 transition-colors',
                timeframe === tf ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-200'
              )}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-bg-card flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-dim shrink-0">
          <span className="text-sm font-bold text-white">{symbol} — Fullscreen</span>
          <button
            onClick={() => setFullscreen(false)}
            className="text-text-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {header}
        <div className="flex-1 min-h-0">
          <ChartCanvas
            symbol={symbol}
            chartType={chartType}
            timeframe={timeframe}
            fullscreen={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
      {header}
      <ChartCanvas
        symbol={symbol}
        chartType={chartType}
        timeframe={timeframe}
        fullscreen={false}
      />
    </div>
  );
}
