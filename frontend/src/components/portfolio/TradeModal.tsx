import { useState } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { placeSchwabOrder, type SchwabOrder } from '../../services/schwabService';
import clsx from 'clsx';

interface TradeModalProps {
  symbol: string;
  currentPrice: number | null;
  accountNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Side = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function TradeModal({ symbol, currentPrice, accountNumber, onClose, onSuccess }: TradeModalProps) {
  const [side, setSide] = useState<Side>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState(currentPrice != null ? String(currentPrice.toFixed(2)) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const qty = parseFloat(quantity);
  const lp = parseFloat(limitPrice);
  const execPrice = orderType === 'MARKET' ? currentPrice : (isNaN(lp) ? null : lp);
  const estimatedTotal = !isNaN(qty) && qty > 0 && execPrice != null ? qty * execPrice : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      setError('Enter a valid whole number of shares.');
      return;
    }
    if (orderType === 'LIMIT' && (isNaN(lp) || lp <= 0)) {
      setError('Enter a valid limit price.');
      return;
    }

    const order: SchwabOrder = {
      orderType,
      instruction: side === 'BUY' ? 'BUY' : 'SELL',
      symbol,
      quantity: qty,
      ...(orderType === 'LIMIT' ? { limitPrice: lp } : {}),
    };

    setLoading(true);
    try {
      await placeSchwabOrder(accountNumber, order);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Order failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70">
      <div className="bg-bg-card border border-border-dim rounded-t-2xl sm:rounded-xl p-5 w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base">{symbol}</span>
            {currentPrice != null && (
              <span className="text-sm text-text-muted font-mono">${fmt(currentPrice)}</span>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
            <p className="text-sm font-semibold text-white">Order Submitted</p>
            <p className="text-xs text-text-muted">
              {side} {qty} share{qty !== 1 ? 's' : ''} of {symbol}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Buy / Sell toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border-dim">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
                  side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-gray-300'
                )}
              >
                <ArrowUpCircle className="w-4 h-4" /> Buy
              </button>
              <div className="w-px bg-border-dim" />
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
                  side === 'SELL' ? 'bg-red-500/20 text-red-400' : 'text-text-muted hover:text-gray-300'
                )}
              >
                <ArrowDownCircle className="w-4 h-4" /> Sell
              </button>
            </div>

            {/* Order type */}
            <div className="flex gap-2">
              {(['MARKET', 'LIMIT'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={clsx(
                    'flex-1 py-1.5 rounded text-xs font-medium border transition-colors',
                    orderType === t
                      ? 'bg-accent/20 border-accent/50 text-accent'
                      : 'border-border-dim text-text-muted hover:text-gray-300'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Shares */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Shares</label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
              />
            </div>

            {/* Limit price */}
            {orderType === 'LIMIT' && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Limit Price</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
                />
              </div>
            )}

            {/* Estimated total */}
            {estimatedTotal != null && (
              <div className="bg-bg-hover rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-text-muted">
                  {orderType === 'MARKET' ? 'Est. Total' : 'Limit Total'}
                </span>
                <span className="text-sm font-semibold text-white font-mono">
                  ${fmt(estimatedTotal)}
                </span>
              </div>
            )}

            {orderType === 'MARKET' && (
              <p className="text-[10px] text-text-muted/70 -mt-2">
                Market orders execute at the next available price.
              </p>
            )}

            {error && (
              <div className="flex gap-2 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'w-full py-3 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                side === 'BUY' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
              )}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </div>
              ) : (
                `Place ${side === 'BUY' ? 'Buy' : 'Sell'} Order`
              )}
            </button>

            <p className="text-[10px] text-text-muted/60 text-center">
              DAY order · equity only · live account
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
