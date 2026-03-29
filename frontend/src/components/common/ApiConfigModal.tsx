import { useState, useEffect } from 'react';
import { Settings, Wifi, X, Check } from 'lucide-react';

interface ApiConfigModalProps {
  open: boolean;
  onClose: () => void;
}

export function ApiConfigModal({ open, onClose }: ApiConfigModalProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(localStorage.getItem('TRADEEDGE_API_URL') || 'http://localhost:3001');
  }, []);

  function save() {
    localStorage.setItem('TRADEEDGE_API_URL', url.trim());
    window.location.reload(); // reload to use new base URL
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-card border border-border-dim rounded-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm text-white">Backend Server URL</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          Enter the URL of your TradeEdge backend server. On the same WiFi, this is your
          PC's local IP address (e.g. <code className="text-accent">http://192.168.1.x:3001</code>).
        </p>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.100:3001"
          className="w-full bg-bg-hover border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded py-2 text-sm font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Save & Reload
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-bg-hover hover:bg-border-dim text-text-dim rounded py-2 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
