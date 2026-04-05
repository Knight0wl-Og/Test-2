import { useState } from 'react';
import { Briefcase, X } from 'lucide-react';

export interface Position {
  id: string;
  symbol: string;
  shares: number;
  avgCost: number;
  addedAt: number;
}

interface AddPositionModalProps {
  onClose: () => void;
  onAdded: (position: Position) => void;
}

export function AddPositionModal({ onClose, onAdded }: AddPositionModalProps) {
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const sh = parseFloat(shares);
    const cost = parseFloat(avgCost);
    if (!sym) { setError('Enter a symbol.'); return; }
    if (isNaN(sh) || sh <= 0) { setError('Enter a valid share count.'); return; }
    if (isNaN(cost) || cost <= 0) { setError('Enter a valid average cost.'); return; }

    onAdded({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      symbol: sym,
      shares: sh,
      avgCost: cost,
      addedAt: Date.now(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-card border border-border-dim rounded-xl p-5 w-full max-w-xs mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-white">Add Position</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full bg-bg-hover border border-border-dim rounded px-3 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Shares</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="10"
              className="w-full bg-bg-hover border border-border-dim rounded px-3 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Avg Cost Per Share</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="150.00"
              className="w-full bg-bg-hover border border-border-dim rounded px-3 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-accent hover:bg-accent-hover text-white rounded py-2 text-sm font-medium transition-colors"
            >
              Add Position
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 bg-bg-hover hover:bg-border-dim text-text-muted rounded py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
