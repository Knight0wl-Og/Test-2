// Pure-TS technical indicators computed from daily price history.
// Replaces the FMP technical_indicator endpoint (premium-only) — feed with
// fetchHistory(symbol, '2y', '1d') so EMA200 has enough bars to converge.

import type { OHLCVBar } from '../types';

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  // Seed with SMA of the first `period` values
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;
  out[period - 1] = seed;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + (out[i - 1] as number) * (1 - k);
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder smoothing
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdPoint[] {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );

  // Signal = EMA of the MACD line over its non-null region
  const firstIdx = macdLine.findIndex((v) => v != null);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  if (firstIdx >= 0) {
    const region = macdLine.slice(firstIdx) as number[];
    const sig = ema(region, signalPeriod);
    for (let i = 0; i < sig.length; i++) signalLine[firstIdx + i] = sig[i];
  }

  return values.map((_, i) => ({
    macd: macdLine[i],
    signal: signalLine[i],
    histogram:
      macdLine[i] != null && signalLine[i] != null
        ? (macdLine[i] as number) - (signalLine[i] as number)
        : null,
  }));
}

export interface TechnicalSnapshot {
  price: number;
  rsi14: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  macd: MacdPoint;
}

/** Latest values of every indicator, or null if there is not enough history. */
export function computeTechnicalSnapshot(bars: OHLCVBar[]): TechnicalSnapshot | null {
  if (!bars || bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const last = closes.length - 1;
  const macdSeries = macd(closes);
  return {
    price: closes[last],
    rsi14: rsi(closes, 14)[last],
    ema20: ema(closes, 20)[last],
    ema50: ema(closes, 50)[last],
    ema200: ema(closes, 200)[last],
    sma20: sma(closes, 20)[last],
    sma50: sma(closes, 50)[last],
    sma200: sma(closes, 200)[last],
    macd: macdSeries[last],
  };
}
