import { useState } from 'react';
import { Search, Bell, Settings, Activity, PanelLeft } from 'lucide-react';
import { useMarketStatus } from '../../hooks/useMarketData';
import clsx from 'clsx';

interface HeaderProps {
  onSearch?: (query: string) => void;
  onToggleWatchlist?: () => void;
}

export function Header({ onSearch, onToggleWatchlist }: HeaderProps) {
  const [query, setQuery] = useState('');
  const { data: status } = useMarketStatus();
  const isOpen = status?.marketOpen ?? false;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) onSearch?.(query.trim().toUpperCase());
  }

  return (
    <header className="h-12 bg-bg-secondary border-b border-border-dim flex items-center px-3 gap-3 shrink-0">
      {/* Watchlist toggle — mobile only */}
      <button
        onClick={onToggleWatchlist}
        className="lg:hidden text-text-muted hover:text-gray-200 transition-colors shrink-0"
        title="Toggle watchlist"
      >
        <PanelLeft className="w-5 h-5" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <Activity className="w-5 h-5 text-accent" />
        <span className="font-bold text-sm tracking-wider text-white">TRADEEDGE</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker…"
            className="w-full bg-bg-card border border-border-dim rounded pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {/* Market status */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className={clsx('w-2 h-2 rounded-full shrink-0', isOpen ? 'bg-green animate-pulse' : 'bg-text-muted')} />
          <span className={clsx('font-medium hidden sm:inline', isOpen ? 'text-green' : 'text-text-muted')}>
            {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
          <span className={clsx('font-medium sm:hidden text-xs', isOpen ? 'text-green' : 'text-text-muted')}>
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>

        <button className="text-text-muted hover:text-gray-200 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <button className="text-text-muted hover:text-gray-200 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
