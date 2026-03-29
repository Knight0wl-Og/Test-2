// ---- Quote / Market Data ----

export interface Quote {
  symbol: string;
  shortName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number | null;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  pe: number | null;
  eps: number | null;
  marketState: string;
  currency: string;
}

export interface OHLCVBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SectorData {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

export interface FearGreedData {
  fgi: {
    now: { value: number; valueText: string };
    previousClose: { value: number; valueText: string };
    oneWeekAgo: { value: number; valueText: string };
    oneMonthAgo: { value: number; valueText: string };
  };
  _fallback?: boolean;
}

// ---- Watchlist ----

export interface WatchlistGroup {
  id: string;
  name: string;
  color: string;
  position: number;
  symbols: string[];
}

// ---- UI ----

export type ChartType = 'candlestick' | 'line' | 'area';
export type ChartPeriod = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';
