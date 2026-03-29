import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useWatchlistStore } from '../../store/watchlistStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [activeNav, setActiveNav] = useState('dashboard');
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  function handleSearch(symbol: string) {
    selectSymbol(symbol);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      <Header onSearch={handleSearch} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={activeNav} onNavigate={setActiveNav} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
