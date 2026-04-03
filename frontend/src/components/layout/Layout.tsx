import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { WatchlistPanel } from '../watchlist/WatchlistPanel';
import { useWatchlistStore } from '../../store/watchlistStore';
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

  const activeNav = Object.entries(ROUTE_MAP).find(([, path]) => path === location.pathname)?.[0] ?? 'dashboard';

  function handleNavigate(id: string) {
    const path = ROUTE_MAP[id];
    if (path) navigate(path);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
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
    </div>
  );
}
