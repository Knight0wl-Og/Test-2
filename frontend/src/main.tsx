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

// Handle Schwab OAuth redirect: tradeedge://oauth/callback?code=...
if (Capacitor.isNativePlatform()) {
  (async () => {
    try {
      const { App: CapApp } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');
      const { exchangeSchwabCode } = await import('./services/schwabService');

      CapApp.addListener('appUrlOpen', async (event) => {
        if (!event.url.startsWith('tradeedge://oauth/callback')) return;
        const url = new URL(event.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error) {
          try { await Browser.close(); } catch { /* ignore */ }
          alert(`Schwab login failed: ${error}. Please try again.`);
          return;
        }
        if (!code) return;
        try {
          await Browser.close();
          await exchangeSchwabCode(code);
          // Reload so Schwab routing kicks in immediately
          window.location.reload();
        } catch (e) {
          console.error('Schwab token exchange failed:', e);
          alert(`Failed to connect Schwab: ${e instanceof Error ? e.message : 'Unknown error'}. Check your Client ID and Secret in Settings.`);
        }
      });
    } catch {
      // @capacitor/app not available
    }
  })();
}
