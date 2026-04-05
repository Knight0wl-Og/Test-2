import { useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { MarketOverview } from '../components/dashboard/MarketOverview';
import { SectorHeatmap } from '../components/dashboard/SectorHeatmap';
import { VIXWidget } from '../components/dashboard/VIXWidget';
import { FearGreedWidget } from '../components/dashboard/FearGreedWidget';
import { CreatorInsights } from '../components/dashboard/CreatorInsights';
import { PriceChart } from '../components/chart/PriceChart';
import { useWatchlistStore } from '../store/watchlistStore';

const PULL_THRESHOLD = 64; // px

export function Dashboard() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const queryClient = useQueryClient();

  // Pull-to-refresh state
  const touchStartY = useRef(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop > 0) return; // only trigger when at top
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.5, PULL_THRESHOLD + 20));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullY >= PULL_THRESHOLD) {
      setRefreshing(true);
      await queryClient.invalidateQueries();
      setRefreshing(false);
    }
    setPullY(0);
  }, [pullY, queryClient]);

  const showIndicator = pullY > 8 || refreshing;

  return (
    <div
      className="p-4 space-y-6 min-h-full relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {showIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10 transition-all"
          style={{ height: `${Math.max(pullY, refreshing ? 40 : 0)}px` }}
        >
          <RefreshCw
            className={`w-5 h-5 text-accent transition-transform ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${(pullY / PULL_THRESHOLD) * 180}deg)` }}
          />
        </div>
      )}

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

          {/* Creator picks & philosophy */}
          <CreatorInsights />
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
