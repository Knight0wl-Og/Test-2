import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { addAlert } from '../../services/alertsService';

interface AddAlertModalProps {
  defaultSymbol?: string;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddAlertModal({ defaultSymbol = '', onClose, onAdded }: AddAlertModalProps) {
  const [symbol, setSymbol] = useState(defaultSymbol.toUpperCase());
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const p = parseFloat(price);
    if (!sym) { setError('Enter a symbol.'); return; }
    if (isNaN(p) || p <= 0) { setError('Enter a valid price.'); return; }
    addAlert(sym, p, direction);
    onAdded?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="card-surface p-5 w-full max-w-xs mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-white">New Alert</span>
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
            <label className="block text-xs text-text-muted mb-1">Direction</label>
            <div className="flex rounded overflow-hidden border border-border-dim text-xs">
              {(['above', 'below'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex-1 py-1.5 capitalize transition-colors ${direction === d ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-200'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Target Price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-bg-hover border border-border-dim rounded px-3 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-accent hover:bg-accent-hover text-white rounded py-2 text-sm font-medium transition-colors"
            >
              Set Alert
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
