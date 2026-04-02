import { useEffect, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import clsx from 'clsx';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useQuotes } from '../../hooks/useQuotes';
import { WatchlistGroupPanel } from './WatchlistGroup';
import type { Quote } from '../../types';

interface WatchlistPanelProps {
  open?: boolean;
  onClose?: () => void;
}

export function WatchlistPanel({ open = false, onClose }: WatchlistPanelProps) {
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
    onClose?.(); // close drawer on mobile after selecting
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          'flex flex-col bg-bg-secondary border-r border-border-dim transition-transform duration-300 ease-in-out',
          // Mobile: fixed drawer sliding in from left
          'fixed inset-y-0 left-0 z-50 w-72',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static in the flex flow, always visible
          'lg:static lg:translate-x-0 lg:w-52 lg:shrink-0 lg:z-auto'
        )}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-dim">
          <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">Watchlists</span>
          <div className="flex items-center gap-1">
            {loading && <RefreshCw className="w-3 h-3 text-text-muted animate-spin" />}
            <button
              onClick={() => setAddingGroup((a) => !a)}
              className="text-text-muted hover:text-accent transition-colors"
              title="New group"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {/* Close button — mobile only */}
            <button
              onClick={onClose}
              className="lg:hidden ml-1 text-text-muted hover:text-gray-200 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Add group form */}
        {addingGroup && (
          <form onSubmit={submitAddGroup} className="px-3 py-2 border-b border-border-dim">
            <input
              autoFocus
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full bg-bg-card border border-accent/50 rounded px-2 py-1 text-xs text-gray-200 placeholder-text-muted focus:outline-none"
              onBlur={() => !newGroupName && setAddingGroup(false)}
            />
          </form>
        )}

        {/* Groups list */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
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
      </div>
    </>
  );
}
