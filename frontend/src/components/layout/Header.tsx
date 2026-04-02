import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Settings, Activity, PanelLeft, X, Wifi, Check } from 'lucide-react';
import { useMarketStatus } from '../../hooks/useMarketData';
import clsx from 'clsx';

interface HeaderProps {
  onSearch?: (query: string) => void;
  onToggleWatchlist?: () => void;
}

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-72 bg-bg-card border border-border-dim rounded-xl shadow-xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim">
        <span className="text-sm font-semibold text-white">Notifications</span>
        <button onClick={onClose} className="text-text-muted hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-6 text-center">
        <Bell className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
        <p className="text-sm text-text-muted">No active alerts</p>
        <p className="text-xs text-text-muted/60 mt-1">Price alert functionality coming soon</p>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState(
    localStorage.getItem('TRADEEDGE_API_URL') || 'http://localhost:3001'
  );

  function save() {
    localStorage.setItem('TRADEEDGE_API_URL', url.trim());
    window.location.reload();
  }

  function resetWatchlists() {
    localStorage.removeItem('tradeedge_watchlists');
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-card border border-border-dim rounded-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-white">Settings</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Backend URL */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wifi className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-gray-300">Backend Server URL</span>
          </div>
          <p className="text-xs text-text-muted mb-2 leading-relaxed">
            Used on Electron/web only. On Android the app connects directly to Yahoo Finance.
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.100:3001"
            className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={save}
            className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded py-2 text-sm font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Save & Reload
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-bg-hover hover:bg-border-dim text-text-muted rounded py-2 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Danger zone */}
        <div className="border-t border-border-dim pt-4">
          <p className="text-xs text-text-muted mb-2">Danger zone</p>
          <button
            onClick={resetWatchlists}
            className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/40 hover:border-red-700/60 rounded py-1.5 transition-colors"
          >
            Reset watchlists to defaults
          </button>
        </div>

        <p className="text-xs text-text-muted/50 mt-4 text-center">TradeEdge v1.0.0</p>
      </div>
    </div>
  );
}

export function Header({ onSearch, onToggleWatchlist }: HeaderProps) {
  const [query, setQuery] = useState('');
  const { data: status } = useMarketStatus();
  const isOpen = status?.marketOpen ?? false;
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className={clsx(
              'text-text-muted hover:text-gray-200 transition-colors',
              showNotifications && 'text-gray-200'
            )}
          >
            <Bell className="w-4 h-4" />
          </button>
          {showNotifications && (
            <NotificationsDropdown onClose={() => setShowNotifications(false)} />
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="text-text-muted hover:text-gray-200 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
}
