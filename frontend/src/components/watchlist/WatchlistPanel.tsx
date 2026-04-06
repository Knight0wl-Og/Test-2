import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import clsx from 'clsx';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useQuotes } from '../../hooks/useQuotes';
import { WatchlistGroupPanel } from './WatchlistGroup';
import type { Quote } from '../../types';

interface WatchlistPanelProps {
  /** Mobile only: controlled open/close */
  open?: boolean;
  onClose?: () => void;
  /** When true, renders as a persistent right-side panel (desktop mode) */
  persistent?: boolean;
}

export function WatchlistPanel({ open = false, onClose, persistent = false }: WatchlistPanelProps) {
  const {
    groups, selectedSymbol, loading,
    loadGroups, selectSymbol, addGroup, removeGroup, addSymbol, removeSymbol, allSymbols,
  } = useWatchlistStore();

  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const { data: quotesArray } = useQuotes(allSymbols());
  const quotesMap = new Map<string, Quote>();
  quotesArray?.forEach((q) => quotesMap.set(q.symbol, q));

  const COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316'];

  // Swipe-to-close (mobile drawer only)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (persistent) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dx < -60 && dy < 40) onClose?.();
  }, [onClose, persistent]);

  function submitAddGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (name) {
      addGroup(name, COLORS[groups.length % COLORS.length]);
      setNewGroupName('');
      setAddingGroup(false);
    }
  }

  function handleSelectSymbol(symbol: string) {
    selectSymbol(symbol);
    if (!persistent) onClose?.();
  }

  const panelContent = (
    <>
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-panel shrink-0">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Watchlists</span>
        <div className="flex items-center gap-1">
          {loading && <RefreshCw className="w-3 h-3 text-text-muted animate-spin" />}
          <button
            onClick={() => setAddingGroup((a) => !a)}
            className="text-text-muted hover:text-accent transition-colors p-0.5"
            title="New group"
          >
            <Plus className="w-3 h-3" />
          </button>
          {!persistent && (
            <button
              onClick={onClose}
              className="ml-1 text-text-muted hover:text-gray-200 transition-colors p-0.5"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Add group form */}
      {addingGroup && (
        <form onSubmit={submitAddGroup} className="px-3 py-1.5 border-b border-panel">
          <input
            autoFocus
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            className="w-full bg-bg-hover border border-accent/50 rounded px-2 py-1 text-xs text-gray-200 placeholder-text-muted focus:outline-none"
            onBlur={() => !newGroupName && setAddingGroup(false)}
          />
        </form>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto py-1 px-0.5">
        {groups.map((group) => (
          <WatchlistGroupPanel
            key={group.id}
            group={group}
            quotes={quotesMap}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={handleSelectSymbol}
            onAddSymbol={addSymbol}
            onRemoveSymbol={removeSymbol}
            onDeleteGroup={removeGroup}
          />
        ))}
        {!loading && groups.length === 0 && (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            No watchlists yet.<br />Click + to create one.
          </div>
        )}
      </div>
    </>
  );

  // ─── Persistent desktop panel ───────────────────────────────────────
  if (persistent) {
    return (
      <div className="hidden lg:flex flex-col w-56 bg-bg-secondary border-l border-panel shrink-0 min-h-0">
        {panelContent}
      </div>
    );
  }

  // ─── Mobile drawer ───────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-bg-secondary border-r border-panel',
          'transition-transform duration-300 ease-in-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {panelContent}
      </div>
    </>
  );
}
