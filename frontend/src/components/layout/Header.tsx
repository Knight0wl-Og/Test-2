import { useState } from 'react';
import { Search, Bell, Settings, Activity } from 'lucide-react';
import { useMarketStatus } from '../../hooks/useMarketData';
import clsx from 'clsx';

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  const [query, setQuery] = useState('');
  const { data: status } = useMarketStatus();
  const isOpen = status?.marketOpen ?? false;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) onSearch?.(query.trim().toUpperCase());
  }

  return (
    <header className="h-12 bg-bg-secondary border-b border-border-dim flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 w-52 shrink-0">
        <Activity className="w-5 h-5 text-accent" />
        <span className="font-bold text-sm tracking-wider text-white">TRADEEDGE</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickers, e.g. AAPL"
            className="w-full bg-bg-card border border-border-dim rounded pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-3">
        {/* Market status */}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={clsx(
              'w-2 h-2 rounded-full',
              isOpen ? 'bg-green animate-pulse' : 'bg-text-muted'
            )}
          />
          <span className={clsx('font-medium', isOpen ? 'text-green' : 'text-text-muted')}>
            {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
        </div>

        {/* Demo mode badge */}
        <span
          title="Live market data requires internet access. Showing realistic demo data."
          className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-gold/40 text-gold/80 bg-gold/5 cursor-default select-none"
        >
          DEMO
        </span>

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
