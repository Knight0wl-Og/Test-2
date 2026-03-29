import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { WatchlistItem } from './WatchlistItem';
import type { WatchlistGroup as WatchlistGroupType, Quote } from '../../types';

interface WatchlistGroupProps {
  group: WatchlistGroupType;
  quotes: Map<string, Quote>;
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  onAddSymbol: (groupId: string, symbol: string) => void;
  onRemoveSymbol: (groupId: string, symbol: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export function WatchlistGroupPanel({
  group,
  quotes,
  selectedSymbol,
  onSelectSymbol,
  onAddSymbol,
  onRemoveSymbol,
  onDeleteGroup,
}: WatchlistGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const sym = newSymbol.trim().toUpperCase();
    if (sym) {
      onAddSymbol(group.id, sym);
      setNewSymbol('');
      setAdding(false);
    }
  }

  return (
    <div className="mb-3">
      {/* Group header */}
      <div className="flex items-center gap-1 px-2 py-1 group/header hover:bg-bg-hover rounded transition-colors">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <ChevronRight
            className={clsx('w-3 h-3 text-text-muted transition-transform', !collapsed && 'rotate-90')}
          />
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: group.color }}
          />
          <span className="text-xs font-semibold text-gray-300 truncate">{group.name}</span>
          <span className="text-xs text-text-muted">({group.symbols.length})</span>
        </button>

        {/* Actions — show on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <button
            onClick={() => setAdding((a) => !a)}
            className="text-text-muted hover:text-accent transition-colors"
            title="Add symbol"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDeleteGroup(group.id)}
            className="text-text-muted hover:text-red transition-colors"
            title="Delete group"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Add symbol input */}
      {adding && (
        <form onSubmit={submitAdd} className="px-3 py-1.5">
          <input
            autoFocus
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Ticker (e.g. AAPL)"
            className="w-full bg-bg-card border border-accent/50 rounded px-2 py-1 text-xs text-gray-200 placeholder-text-muted focus:outline-none uppercase"
            onBlur={() => !newSymbol && setAdding(false)}
          />
        </form>
      )}

      {/* Symbols */}
      {!collapsed && (
        <div className="ml-2">
          {group.symbols.map((sym) => (
            <WatchlistItem
              key={sym}
              symbol={sym}
              quote={quotes.get(sym)}
              selected={selectedSymbol === sym}
              onSelect={() => onSelectSymbol(sym)}
              onRemove={() => onRemoveSymbol(group.id, sym)}
            />
          ))}
          {group.symbols.length === 0 && (
            <div className="px-4 py-1 text-xs text-text-muted italic">No symbols — add one</div>
          )}
        </div>
      )}
    </div>
  );
}
