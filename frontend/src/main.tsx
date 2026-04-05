import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { confirmBundle } from './services/liveUpdate';
import { syncEarningsWatchlist } from './services/earningsSync';
import { Capacitor } from '@capacitor/core';

// Confirm the running bundle is stable (prevents auto-rollback on crash)
confirmBundle();

// Status bar theming on native (Android)
if (Capacitor.isNativePlatform()) {
  (async () => {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setBackgroundColor({ color: '#0a0a0f' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {
      // plugin not available
    }
  })();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Sync earnings calendar into the watchlist 2s after mount (non-blocking)
setTimeout(syncEarningsWatchlist, 2000);
