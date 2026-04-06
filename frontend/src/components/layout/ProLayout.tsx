/**
 * ProLayout — TradingView-inspired layout for v1.5
 *
 * Desktop: slim header + symbol bar + [sidebar | workspace + news | watchlist]
 * Mobile:  page content fills screen, BottomNav fixed at bottom
 */
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Wifi } from 'lucide-react';
import { Header } from './Header';
import { SymbolBar } from './SymbolBar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { WatchlistPanel } from '../watchlist/WatchlistPanel';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/',
  top10: '/top10',
  scanner: '/scanner',
  research: '/research',
  options: '/options',
  copilot: '/copilot',
  alerts: '/alerts',
  portfolio: '/portfolio',
};

interface ProLayoutProps {
  children: React.ReactNode;
  /** Desktop: show the chart workspace sidebar layout (SymbolBar + WorkspacePanel) */
  isChartView?: boolean;
}

export function ProLayout({ children, isChartView = false }: ProLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const { online } = useNetworkStatus();

  const activeNav =
    Object.entries(ROUTE_MAP).find(([, path]) => path === location.pathname)?.[0] ?? 'dashboard';

  function handleNavigate(id: string) {
    const path = ROUTE_MAP[id];
    if (path) navigate(path);
  }

  // Background refresh when native app returns to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) setTimeout(() => queryClient.invalidateQueries(), 1000);
        });
        cleanup = () => { handle.remove(); };
      } catch { /* plugin not available */ }
    })();
    return () => { cleanup?.(); };
  }, [queryClient]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      {/* Offline banner */}
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-yellow-900/60 border-b border-yellow-700/40 px-3 py-1 text-[11px] text-yellow-300 shrink-0">
          <Wifi className="w-3 h-3" />
          No connection — showing cached data
        </div>
      )}

      {/* Slim header — desktop always, mobile always (shows logo + bell + settings) */}
      <Header />

      {/* Symbol bar — desktop only (mobile has its own symbol strip in ChartPage) */}
      {isChartView && (
        <div className="hidden lg:block">
          <SymbolBar />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar — desktop only */}
        <Sidebar active={activeNav} onNavigate={handleNavigate} />

        {/* Center content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <main className="flex-1 min-h-0 overflow-auto pb-14 lg:pb-0">
            {children}
          </main>
        </div>

        {/* Right watchlist — persistent on desktop, hidden on mobile */}
        <WatchlistPanel persistent />
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
