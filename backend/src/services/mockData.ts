import type { Quote, OHLCVBar } from './yahooFinance';

// ── Static quote snapshots ────────────────────────────────────────────────────
const MOCK_QUOTES: Record<string, Omit<Quote, 'symbol'>> = {
  SPY:   { shortName: 'SPDR S&P 500 ETF',         price: 565.40,  change:  4.20,  changePercent:  0.75, volume: 68_400_000,  avgVolume: 72_000_000,  marketCap: null,           open: 562.10, high: 566.80, low: 561.50, previousClose: 561.20, fiftyTwoWeekHigh: 613.23, fiftyTwoWeekLow: 491.70, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  QQQ:   { shortName: 'Invesco QQQ Trust',          price: 480.20,  change:  5.10,  changePercent:  1.07, volume: 42_100_000,  avgVolume: 48_000_000,  marketCap: null,           open: 476.40, high: 481.30, low: 475.80, previousClose: 475.10, fiftyTwoWeekHigh: 540.81, fiftyTwoWeekLow: 400.23, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  DIA:   { shortName: 'SPDR Dow Jones ETF',         price: 422.50,  change:  1.30,  changePercent:  0.31, volume: 4_200_000,   avgVolume: 5_100_000,   marketCap: null,           open: 421.20, high: 423.10, low: 420.80, previousClose: 421.20, fiftyTwoWeekHigh: 453.89, fiftyTwoWeekLow: 373.10, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  IWM:   { shortName: 'iShares Russell 2000 ETF',   price: 208.30,  change: -0.90,  changePercent: -0.43, volume: 18_600_000,  avgVolume: 22_000_000,  marketCap: null,           open: 209.50, high: 210.10, low: 207.80, previousClose: 209.20, fiftyTwoWeekHigh: 244.41, fiftyTwoWeekLow: 186.49, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  '^GSPC': { shortName: 'S&P 500',                  price: 5650.0,  change: 42.0,   changePercent:  0.75, volume: 0,           avgVolume: 0,           marketCap: null,           open: 5612.0, high: 5668.0, low: 5601.0, previousClose: 5608.0, fiftyTwoWeekHigh: 6128.18, fiftyTwoWeekLow: 4911.25, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  '^IXIC': { shortName: 'NASDAQ Composite',         price: 18200.0, change: 193.0,  changePercent:  1.07, volume: 0,           avgVolume: 0,           marketCap: null,           open: 18050.0,high:18260.0, low:18010.0, previousClose:18007.0, fiftyTwoWeekHigh:20204.58, fiftyTwoWeekLow:15222.08, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  '^RUT':  { shortName: 'Russell 2000',             price: 2083.0,  change: -9.0,   changePercent: -0.43, volume: 0,           avgVolume: 0,           marketCap: null,           open: 2095.0, high: 2101.0, low: 2078.0, previousClose: 2092.0, fiftyTwoWeekHigh: 2442.74, fiftyTwoWeekLow: 1852.96, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  '^VIX':  { shortName: 'CBOE Volatility Index',    price: 18.50,   change:  0.80,  changePercent:  4.52, volume: 0,           avgVolume: 0,           marketCap: null,           open: 17.90,  high: 19.10,  low: 17.60,  previousClose: 17.70,  fiftyTwoWeekHigh: 65.73,  fiftyTwoWeekLow: 10.62,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  AAPL:  { shortName: 'Apple Inc.',                 price: 213.50,  change:  2.55,  changePercent:  1.21, volume: 52_300_000,  avgVolume: 62_000_000,  marketCap: 3_210_000_000_000, open: 211.40, high: 214.20, low: 210.80, previousClose: 210.95, fiftyTwoWeekHigh: 260.10, fiftyTwoWeekLow: 164.08, pe: 35.2, eps: 6.43, marketState: 'CLOSED', currency: 'USD' },
  NVDA:  { shortName: 'NVIDIA Corporation',         price: 875.40,  change: 23.90,  changePercent:  2.81, volume: 38_100_000,  avgVolume: 42_000_000,  marketCap: 2_150_000_000_000, open: 855.20, high: 878.50, low: 852.10, previousClose: 851.50, fiftyTwoWeekHigh: 1220.50, fiftyTwoWeekLow: 505.38, pe: 68.4, eps: 12.96, marketState: 'CLOSED', currency: 'USD' },
  MSFT:  { shortName: 'Microsoft Corporation',      price: 415.20,  change: -1.65,  changePercent: -0.40, volume: 18_200_000,  avgVolume: 21_000_000,  marketCap: 3_080_000_000_000, open: 417.40, high: 418.20, low: 414.10, previousClose: 416.85, fiftyTwoWeekHigh: 468.35, fiftyTwoWeekLow: 362.90, pe: 37.8, eps: 12.05, marketState: 'CLOSED', currency: 'USD' },
  GOOGL: { shortName: 'Alphabet Inc.',              price: 175.30,  change:  1.90,  changePercent:  1.10, volume: 22_400_000,  avgVolume: 25_000_000,  marketCap: 2_180_000_000_000, open: 173.80, high: 176.10, low: 173.20, previousClose: 173.40, fiftyTwoWeekHigh: 208.70, fiftyTwoWeekLow: 130.67, pe: 24.1, eps: 7.52, marketState: 'CLOSED', currency: 'USD' },
  META:  { shortName: 'Meta Platforms, Inc.',       price: 595.80,  change:  9.90,  changePercent:  1.69, volume: 12_800_000,  avgVolume: 14_000_000,  marketCap: 1_520_000_000_000, open: 588.20, high: 597.40, low: 587.10, previousClose: 585.90, fiftyTwoWeekHigh: 740.92, fiftyTwoWeekLow: 414.50, pe: 29.3, eps: 22.05, marketState: 'CLOSED', currency: 'USD' },
  PLTR:  { shortName: 'Palantir Technologies',      price: 28.45,   change:  0.88,  changePercent:  3.19, volume: 68_100_000,  avgVolume: 72_000_000,  marketCap: 60_800_000_000, open: 27.70,  high: 28.80,  low: 27.50,  previousClose: 27.57,  fiftyTwoWeekHigh: 45.00,  fiftyTwoWeekLow: 14.70,  pe: 245.0, eps: 0.12, marketState: 'CLOSED', currency: 'USD' },
  TSLA:  { shortName: 'Tesla, Inc.',                price: 252.40,  change: -4.60,  changePercent: -1.79, volume: 88_200_000,  avgVolume: 95_000_000,  marketCap: 803_000_000_000, open: 257.80,  high: 258.30, low: 251.10, previousClose: 257.00, fiftyTwoWeekHigh: 488.54,  fiftyTwoWeekLow: 138.80,  pe: 89.2, eps: 2.83, marketState: 'CLOSED', currency: 'USD' },
  AMD:   { shortName: 'Advanced Micro Devices',     price: 158.70,  change:  3.28,  changePercent:  2.11, volume: 34_500_000,  avgVolume: 38_000_000,  marketCap: 257_000_000_000, open: 155.90,  high: 159.40, low: 155.20, previousClose: 155.42, fiftyTwoWeekHigh: 227.30,  fiftyTwoWeekLow: 121.31,  pe: 148.0, eps: 1.07, marketState: 'CLOSED', currency: 'USD' },
  // Sector ETFs
  XLK:   { shortName: 'Technology Select Sector',  price: 228.40,  change:  3.38,  changePercent:  1.50, volume: 8_200_000,   avgVolume: 9_500_000,   marketCap: null, open: 225.60, high: 229.10, low: 225.00, previousClose: 225.02, fiftyTwoWeekHigh: 267.31, fiftyTwoWeekLow: 192.20, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLF:   { shortName: 'Financial Select Sector',   price: 48.20,   change:  0.14,  changePercent:  0.30, volume: 24_100_000,  avgVolume: 28_000_000,  marketCap: null, open: 48.00,  high: 48.40,  low: 47.85,  previousClose: 48.06,  fiftyTwoWeekHigh: 53.83,  fiftyTwoWeekLow: 37.79,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLE:   { shortName: 'Energy Select Sector',      price: 89.50,   change: -0.63,  changePercent: -0.70, volume: 12_400_000,  avgVolume: 14_000_000,  marketCap: null, open: 90.20,  high: 90.50,  low: 89.10,  previousClose: 90.13,  fiftyTwoWeekHigh: 101.54, fiftyTwoWeekLow: 79.60,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLV:   { shortName: 'Health Care Select Sector', price: 147.30,  change:  0.29,  changePercent:  0.20, volume: 6_800_000,   avgVolume: 8_000_000,   marketCap: null, open: 147.00, high: 147.80, low: 146.50, previousClose: 147.01, fiftyTwoWeekHigh: 164.99, fiftyTwoWeekLow: 127.23, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLY:   { shortName: 'Consumer Discret. Sector',  price: 198.60,  change:  1.58,  changePercent:  0.80, volume: 5_100_000,   avgVolume: 6_200_000,   marketCap: null, open: 197.20, high: 199.10, low: 196.80, previousClose: 197.02, fiftyTwoWeekHigh: 226.70, fiftyTwoWeekLow: 164.93, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLP:   { shortName: 'Consumer Staples Sector',   price: 79.40,   change: -0.08,  changePercent: -0.10, volume: 7_300_000,   avgVolume: 8_500_000,   marketCap: null, open: 79.50,  high: 79.70,  low: 79.10,  previousClose: 79.48,  fiftyTwoWeekHigh: 82.50,  fiftyTwoWeekLow: 69.40,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLI:   { shortName: 'Industrial Select Sector',  price: 136.80,  change:  0.68,  changePercent:  0.50, volume: 7_600_000,   avgVolume: 8_900_000,   marketCap: null, open: 136.20, high: 137.10, low: 135.90, previousClose: 136.12, fiftyTwoWeekHigh: 146.23, fiftyTwoWeekLow: 114.18, pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLB:   { shortName: 'Materials Select Sector',   price: 92.10,   change: -0.28,  changePercent: -0.30, volume: 4_200_000,   avgVolume: 5_100_000,   marketCap: null, open: 92.40,  high: 92.60,  low: 91.80,  previousClose: 92.38,  fiftyTwoWeekHigh: 102.95, fiftyTwoWeekLow: 79.47,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLU:   { shortName: 'Utilities Select Sector',   price: 71.20,   change: -0.29,  changePercent: -0.40, volume: 9_800_000,   avgVolume: 11_000_000,  marketCap: null, open: 71.50,  high: 71.70,  low: 70.90,  previousClose: 71.49,  fiftyTwoWeekHigh: 78.10,  fiftyTwoWeekLow: 55.14,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLRE:  { shortName: 'Real Estate Select Sector', price: 44.80,   change: -0.09,  changePercent: -0.20, volume: 6_100_000,   avgVolume: 7_200_000,   marketCap: null, open: 44.90,  high: 45.10,  low: 44.60,  previousClose: 44.89,  fiftyTwoWeekHigh: 48.81,  fiftyTwoWeekLow: 35.56,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
  XLC:   { shortName: 'Comm. Services Sector',     price: 105.60,  change:  1.25,  changePercent:  1.20, volume: 5_500_000,   avgVolume: 6_400_000,   marketCap: null, open: 104.50, high: 106.00, low: 104.30, previousClose: 104.35, fiftyTwoWeekHigh: 118.02, fiftyTwoWeekLow: 76.37,  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD' },
};

const DEFAULT_QUOTE: Omit<Quote, 'symbol'> = {
  shortName: 'Unknown',
  price: 100.00, change: 0.50, changePercent: 0.50,
  volume: 1_000_000, avgVolume: 1_000_000, marketCap: null,
  open: 99.50, high: 100.80, low: 99.20, previousClose: 99.50,
  fiftyTwoWeekHigh: 120.00, fiftyTwoWeekLow: 80.00,
  pe: null, eps: null, marketState: 'CLOSED', currency: 'USD',
};

export function getMockQuote(symbol: string): Quote {
  const base = MOCK_QUOTES[symbol] ?? { ...DEFAULT_QUOTE, shortName: symbol };
  return { symbol, ...base };
}

export function getMockBatchQuotes(symbols: string[]): Quote[] {
  return symbols.map(getMockQuote);
}

/** Seeded pseudo-random number generator (deterministic per symbol) */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function getMockHistory(symbol: string, days = 90): OHLCVBar[] {
  const baseQuote = MOCK_QUOTES[symbol];
  const endPrice = baseQuote?.price ?? 100;
  // Work backwards from current price to generate history
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);

  const bars: OHLCVBar[] = [];
  const endTs = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  let price = endPrice;

  // Generate in reverse then reverse the array
  for (let i = 0; i < days; i++) {
    const ts = endTs - i * DAY;
    // Skip weekends
    const d = new Date(ts * 1000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;

    // Walking backwards: `price` is this bar's close; derive open from a move
    const dailyMove = (rand() - 0.48) * 0.025; // slight upward bias
    const close = price;
    const open = close / (1 + dailyMove); // reverse: open is earlier than close
    const highWick = rand() * 0.008;
    const lowWick = rand() * 0.008;
    const high = Math.max(open, close) * (1 + highWick);
    const low = Math.min(open, close) * (1 - lowWick);
    const baseVol = baseQuote?.volume ?? 5_000_000;
    const volume = Math.round(baseVol * (0.7 + rand() * 0.6));

    bars.unshift({
      time: ts,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    price = open; // yesterday's close = today's open (reverse walk)
  }
  return bars;
}

export function getMockFearGreed() {
  return {
    fgi: {
      now:          { value: 58, valueText: 'Greed' },
      previousClose:{ value: 55, valueText: 'Greed' },
      oneWeekAgo:   { value: 48, valueText: 'Neutral' },
      oneMonthAgo:  { value: 38, valueText: 'Fear' },
    },
  };
}
