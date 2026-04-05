import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Check, Clock } from 'lucide-react';
import clsx from 'clsx';
import { loadAlerts, removeAlert, clearTriggeredAlerts, type PriceAlert } from '../services/alertsService';
import { AddAlertModal } from '../components/common/AddAlertModal';
import { useWatchlistStore } from '../store/watchlistStore';
import { useNavigate } from 'react-router-dom';

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function Alerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts());
  const [showAdd, setShowAdd] = useState(false);
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const navigate = useNavigate();

  function refresh() { setAlerts(loadAlerts()); }

  function handleRemove(id: string) {
    removeAlert(id);
    refresh();
  }

  function handleClearTriggered() {
    clearTriggeredAlerts();
    refresh();
  }

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-accent" />
        <h1 className="text-sm font-semibold text-white">Price Alerts</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Alert
        </button>
      </div>

      {/* Active alerts */}
      <div className="space-y-2">
        <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
          Active ({active.length})
        </p>

        {active.length === 0 && (
          <div className="bg-bg-card border border-border-dim rounded-lg p-6 text-center space-y-2">
            <Bell className="w-7 h-7 text-text-muted/40 mx-auto" />
            <p className="text-sm text-text-muted">No active alerts</p>
            <p className="text-xs text-text-muted/60">Click "New Alert" to set a price target</p>
          </div>
        )}

        {active.map((alert) => (
          <div key={alert.id} className="bg-bg-card border border-border-dim rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div
              className={clsx(
                'w-1.5 h-8 rounded-full shrink-0',
                alert.direction === 'above' ? 'bg-green' : 'bg-red-400'
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  className="text-sm font-semibold text-white hover:text-accent transition-colors"
                  onClick={() => { selectSymbol(alert.symbol); navigate('/'); }}
                >
                  {alert.symbol}
                </button>
                <span className={clsx('text-xs font-medium', alert.direction === 'above' ? 'text-green' : 'text-red-400')}>
                  {alert.direction === 'above' ? '↑ above' : '↓ below'} ${fmt(alert.targetPrice)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-text-muted">
                <Clock className="w-3 h-3" />
                Set {timeAgo(alert.createdAt)}
              </div>
            </div>
            <button
              onClick={() => handleRemove(alert.id)}
              className="text-text-muted/40 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
              Triggered ({triggered.length})
            </p>
            <button
              onClick={handleClearTriggered}
              className="text-xs text-text-muted hover:text-gray-300 underline"
            >
              Clear all
            </button>
          </div>

          {triggered.map((alert) => (
            <div key={alert.id} className="bg-bg-card border border-border-dim/50 rounded-lg px-3 py-2.5 flex items-center gap-3 opacity-70">
              <div className="w-1.5 h-8 rounded-full shrink-0 bg-accent/40" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm font-semibold text-gray-400 hover:text-accent transition-colors"
                    onClick={() => { selectSymbol(alert.symbol); navigate('/'); }}
                  >
                    {alert.symbol}
                  </button>
                  <span className="text-xs text-text-muted">
                    {alert.direction} ${fmt(alert.targetPrice)}
                  </span>
                  {alert.triggeredPrice != null && (
                    <span className="text-xs text-text-muted">
                      → hit ${fmt(alert.triggeredPrice)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-text-muted">
                  <Check className="w-3 h-3 text-green" />
                  Triggered {alert.triggeredAt ? timeAgo(alert.triggeredAt) : ''}
                </div>
              </div>
              <button
                onClick={() => handleRemove(alert.id)}
                className="text-text-muted/40 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddAlertModal
          onClose={() => setShowAdd(false)}
          onAdded={refresh}
        />
      )}
    </div>
  );
}
