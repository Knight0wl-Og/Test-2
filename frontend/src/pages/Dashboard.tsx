import { MarketOverview } from '../components/dashboard/MarketOverview';
import { SectorHeatmap } from '../components/dashboard/SectorHeatmap';
import { VIXWidget } from '../components/dashboard/VIXWidget';
import { FearGreedWidget } from '../components/dashboard/FearGreedWidget';
import { PriceChart } from '../components/chart/PriceChart';
import { useWatchlistStore } from '../store/watchlistStore';

export function Dashboard() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);

  return (
    <div className="p-4 space-y-6 min-h-full">
      {/* Market Overview — indices row */}
      <MarketOverview />

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Chart */}
          {selectedSymbol ? (
            <PriceChart symbol={selectedSymbol} />
          ) : (
            <div className="bg-bg-card border border-border-dim rounded-lg p-8 text-center text-text-muted text-sm">
              Select a symbol from the watchlist or market overview to view its chart.
            </div>
          )}

          {/* Sector heatmap */}
          <SectorHeatmap />
        </div>

        {/* Right column — widgets */}
        <div className="space-y-4">
          <FearGreedWidget />
          <VIXWidget />

          {/* Legal disclaimer */}
          <div className="bg-bg-card border border-border-dim rounded-lg p-3">
            <p className="text-xs text-text-muted leading-relaxed">
              <strong className="text-gray-400">Disclaimer:</strong> TradeEdge is for informational
              and educational purposes only. Nothing in this app constitutes financial advice.
              Options trading involves significant risk of loss. Past performance does not guarantee
              future results. Always consult a licensed financial advisor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
