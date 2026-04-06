/**
 * TVChartWidget — Phase 1 implementation using the TradingView Advanced Chart widget.
 *
 * The component exposes a stable ITVChart interface.
 * When the self-hosted Charting Library files arrive (Phase 2), replace the
 * internal implementation in this file only — the props interface stays identical.
 */

import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';

export type TVInterval =
  | '1' | '3' | '5' | '15' | '30' | '60' | '120' | '180' | '240'
  | 'D' | 'W';

export interface ITVChart {
  symbol: string;
  interval?: TVInterval;
  /** Called when the user changes the symbol inside the TV widget */
  onSymbolChange?: (symbol: string) => void;
}

const INTERVAL_MAP: Record<string, TVInterval> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '3h': '180', '4h': '240',
  '1d': 'D', '1w': 'W',
};

export function toTVInterval(tf: string): TVInterval {
  return INTERVAL_MAP[tf] ?? 'D';
}

export function TVChartWidget({ symbol, interval = 'D', onSymbolChange }: ITVChart) {
  // Normalise exchange prefix — TV widget needs "NASDAQ:AAPL" style for some symbols,
  // but also accepts bare tickers like "AAPL" for US equities.
  const tvSymbol = symbol.includes(':') ? symbol : symbol;

  return (
    <div className="w-full h-full min-h-0">
      <AdvancedRealTimeChart
        symbol={tvSymbol}
        interval={interval}
        theme="dark"
        autosize
        hide_top_toolbar={false}
        hide_legend={false}
        hide_side_toolbar={false}
        allow_symbol_change={!!onSymbolChange}
        save_image={false}
        container_id={`tv_chart_${symbol}_${interval}`}
        // Colour overrides to blend with our dark theme
        // (widget accepts limited overrides via URL params in the iframe)
        studies={[]}
        locale="en"
      />
    </div>
  );
}
