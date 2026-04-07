import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Bell, Settings, X,
  Check, RefreshCw, Download, AlertCircle, RotateCcw, Plus, Trash2, Wifi,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { checkAndDownload, applyUpdate, type UpdateProgress } from '../../services/liveUpdate';
import { loadAlerts, removeAlert, type PriceAlert } from '../../services/alertsService';
import { AddAlertModal } from '../common/AddAlertModal';
import clsx from 'clsx';

interface HeaderProps {
  onToggleWatchlist?: () => void;
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts());
  const [showAddAlert, setShowAddAlert] = useState(false);

  function refresh() { setAlerts(loadAlerts()); }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  const triggered = alerts.filter((a) => a.triggered);
  const active = alerts.filter((a) => !a.triggered);

  function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <>
      <div
        ref={ref}
        className="absolute right-0 top-full mt-1 w-72 bg-bg-card border border-border-dim rounded-xl shadow-xl z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-dim">
          <span className="text-xs font-semibold text-white">
            Alerts
            {active.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-accent/20 text-accent rounded-full px-1.5 py-0.5">{active.length}</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddAlert(true)} className="text-text-muted hover:text-accent transition-colors" title="Add alert">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { navigate('/alerts'); onClose(); }} className="text-[10px] text-accent hover:underline">View all</button>
            <button onClick={onClose} className="text-text-muted hover:text-white ml-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto">
          {triggered.length > 0 && (
            <div className="px-3 py-2 border-b border-border-dim/40">
              <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Triggered</p>
              {triggered.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-xs text-gray-300 flex-1"><strong>{a.symbol}</strong> hit ${fmt(a.triggeredPrice ?? a.targetPrice)}</span>
                  <button onClick={() => { removeAlert(a.id); refresh(); }} className="text-text-muted/40 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          {active.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Watching</p>
              {active.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1.5">
                  <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', a.direction === 'above' ? 'bg-green' : 'bg-red-400')} />
                  <span className="text-xs text-gray-300 flex-1"><strong>{a.symbol}</strong> {a.direction} ${fmt(a.targetPrice)}</span>
                  <button onClick={() => { removeAlert(a.id); refresh(); }} className="text-text-muted/40 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          {alerts.length === 0 && (
            <div className="px-3 py-5 text-center">
              <Bell className="w-7 h-7 text-text-muted mx-auto mb-1.5 opacity-40" />
              <p className="text-xs text-text-muted">No alerts set</p>
            </div>
          )}
        </div>
      </div>
      {showAddAlert && <AddAlertModal onClose={() => setShowAddAlert(false)} onAdded={refresh} />}
    </>
  );
}

// ─── Update Section ───────────────────────────────────────────────────────────

function UpdateSection() {
  const [upd, setUpd] = useState<UpdateProgress>({ state: 'idle', progress: 0 });
  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="border-t border-border-dim pt-4 mt-1">
        <p className="text-xs text-text-muted mb-2 uppercase tracking-widest">Updates</p>
        <p className="text-xs text-text-muted/60 leading-relaxed">Windows updates via electron-updater on next launch.</p>
      </div>
    );
  }
  return (
    <div className="border-t border-border-dim pt-4 mt-1">
      <p className="text-xs text-text-muted mb-3 uppercase tracking-widest">Updates</p>
      {upd.state === 'idle' && (
        <button onClick={() => checkAndDownload(setUpd)} className="w-full flex items-center justify-center gap-2 bg-bg-hover hover:bg-border-dim border border-border-dim rounded py-2 text-sm text-gray-200 transition-colors">
          <RefreshCw className="w-4 h-4" />Check for Updates
        </button>
      )}
      {upd.state === 'checking' && (
        <div className="flex items-center gap-2.5 text-xs text-text-muted py-1">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />Checking…
        </div>
      )}
      {upd.state === 'downloading' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-2"><Download className="w-3.5 h-3.5 animate-bounce shrink-0" /><span>Downloading…</span></div>
            <span className="font-mono">{upd.progress}%</span>
          </div>
          <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${upd.progress}%` }} />
          </div>
        </div>
      )}
      {upd.state === 'up-to-date' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-green py-1"><Check className="w-3.5 h-3.5 shrink-0" />You're on the latest version</div>
          <button onClick={() => setUpd({ state: 'idle', progress: 0 })} className="text-xs text-text-muted hover:text-gray-300 underline">Check again</button>
        </div>
      )}
      {upd.state === 'ready' && (
        <div className="space-y-3">
          <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden"><div className="h-full w-full bg-green rounded-full" /></div>
          <div className="flex items-center gap-2 text-xs text-green"><Check className="w-3.5 h-3.5 shrink-0" />Update downloaded</div>
          <button onClick={applyUpdate} className="w-full flex items-center justify-center gap-2 bg-green/20 hover:bg-green/30 border border-green/40 text-green rounded py-2 text-sm font-medium transition-colors">
            <RotateCcw className="w-4 h-4" />Restart Now
          </button>
        </div>
      )}
      {upd.state === 'error' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{upd.message}</span></div>
          <button onClick={() => checkAndDownload(setUpd)} className="w-full flex items-center justify-center gap-2 bg-bg-hover hover:bg-border-dim border border-border-dim rounded py-2 text-sm text-gray-200 transition-colors">
            <RefreshCw className="w-4 h-4" />Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState(localStorage.getItem('TRADEEDGE_API_URL') || 'http://localhost:3001');
  const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('TRADEEDGE_ANTHROPIC_KEY') || '');
  const [finnhubKey, setFinnhubKey] = useState(localStorage.getItem('TRADEEDGE_FINNHUB_KEY') || '');
  const [polygonKey, setPolygonKey] = useState(localStorage.getItem('TRADEEDGE_POLYGON_KEY') || '');

  function save() {
    localStorage.setItem('TRADEEDGE_API_URL', url.trim());
    if (anthropicKey.trim()) localStorage.setItem('TRADEEDGE_ANTHROPIC_KEY', anthropicKey.trim());
    else localStorage.removeItem('TRADEEDGE_ANTHROPIC_KEY');
    if (finnhubKey.trim()) localStorage.setItem('TRADEEDGE_FINNHUB_KEY', finnhubKey.trim());
    else localStorage.removeItem('TRADEEDGE_FINNHUB_KEY');
    if (polygonKey.trim()) localStorage.setItem('TRADEEDGE_POLYGON_KEY', polygonKey.trim());
    else localStorage.removeItem('TRADEEDGE_POLYGON_KEY');
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-card border border-border-dim rounded-xl p-5 w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-white">Settings</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5"><Wifi className="w-3.5 h-3.5 text-text-muted" /><span className="text-xs font-medium text-gray-300">Backend Server URL</span></div>
          <p className="text-xs text-text-muted mb-2">Electron/web only. Android connects directly to Yahoo Finance.</p>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.1.100:3001" className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent" />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5"><span className="text-xs font-medium text-gray-300">Anthropic API Key</span><span className="text-[10px] text-text-muted">(AI Copilot)</span></div>
          <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-…" className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono" />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs font-medium text-gray-300">Finnhub API Key</span>
            <span className="text-[10px] text-text-muted">(earnings, analyst ratings)</span>
            <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline ml-auto">free at finnhub.io</a>
          </div>
          <input type="password" value={finnhubKey} onChange={(e) => setFinnhubKey(e.target.value)} placeholder="d_xxxxxxxxxxxxxxxx" className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono" />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs font-medium text-gray-300">Polygon.io API Key</span>
            <span className="text-[10px] text-text-muted">(options Greeks, flow)</span>
            <a href="https://polygon.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline ml-auto">free at polygon.io</a>
          </div>
          <input type="password" value={polygonKey} onChange={(e) => setPolygonKey(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono" />
        </div>

        <div className="flex gap-2 mb-2">
          <button onClick={save} className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded py-2 text-sm font-medium transition-colors">
            <Check className="w-4 h-4" />Save & Reload
          </button>
          <button onClick={onClose} className="px-4 bg-bg-hover text-text-muted rounded py-2 text-sm transition-colors">Cancel</button>
        </div>

        <UpdateSection />

        <div className="border-t border-border-dim pt-4 mt-4">
          <p className="text-xs text-text-muted mb-2">Danger zone</p>
          <button onClick={() => { localStorage.removeItem('tradeedge_watchlists'); window.location.reload(); }} className="w-full text-xs text-red-400 hover:text-red-300 border border-red-900/40 rounded py-1.5 transition-colors">
            Reset watchlists to defaults
          </button>
        </div>
        <p className="text-xs text-text-muted/50 mt-4 text-center">TradeEdge v1.5.0</p>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header({ onToggleWatchlist }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const activeAlerts = loadAlerts().filter((a) => !a.triggered);

  return (
    <header className="h-10 bg-bg-secondary border-b border-panel flex items-center px-3 gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <Activity className="w-4 h-4 text-accent" />
        <span className="font-bold text-sm tracking-wider text-white hidden sm:inline">TRADEEDGE</span>
      </div>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className={clsx('text-text-muted hover:text-gray-200 transition-colors relative', showNotifications && 'text-gray-200')}
          >
            <Bell className="w-4 h-4" />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
              </span>
            )}
          </button>
          {showNotifications && <NotificationsDropdown onClose={() => setShowNotifications(false)} />}
        </div>
        <button onClick={() => setShowSettings(true)} className="text-text-muted hover:text-gray-200 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
}
