import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { WatchlistPanel } from '../watchlist/WatchlistPanel';
import { useWatchlistStore } from '../../store/watchlistStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      <Header
        onSearch={(symbol) => selectSymbol(symbol)}
        onToggleWatchlist={() => setWatchlistOpen((o) => !o)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={activeNav} onNavigate={setActiveNav} />
        <WatchlistPanel
          open={watchlistOpen}
          onClose={() => setWatchlistOpen(false)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
