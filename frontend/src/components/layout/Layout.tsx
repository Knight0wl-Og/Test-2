import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { WatchlistPanel } from '../watchlist/WatchlistPanel';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useState } from 'react';

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

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { online } = useNetworkStatus();

  const activeNav = Object.entries(ROUTE_MAP).find(([, path]) => path === location.pathname)?.[0] ?? 'dashboard';

  function handleNavigate(id: string) {
    const path = ROUTE_MAP[id];
    if (path) navigate(path);
  }

  // Background refresh when app returns to foreground (native)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            setTimeout(() => queryClient.invalidateQueries(), 1000);
          }
        });
        cleanup = () => { handle.remove(); };
      } catch {
        // plugin not available
      }
    })();

    return () => { cleanup?.(); };
  }, [queryClient]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      {/* Offline banner */}
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-yellow-900/60 border-b border-yellow-700/40 px-3 py-1.5 text-xs text-yellow-300 shrink-0">
          <Wifi className="w-3 h-3" />
          No connection — showing cached data
        </div>
      )}

      <Header
        onSearch={(symbol) => { selectSymbol(symbol); navigate('/'); }}
        onToggleWatchlist={() => setWatchlistOpen((o) => !o)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={activeNav} onNavigate={handleNavigate} />
        <WatchlistPanel
          open={watchlistOpen}
          onClose={() => setWatchlistOpen(false)}
        />
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
