import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { confirmBundle } from './services/liveUpdate';
import { syncEarningsWatchlist } from './services/earningsSync';
import { migrateLocalStorageKeys, restoreKeysToLocalStorage } from './services/keyStorage';
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

// Render immediately — never block the UI for key storage.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Key bootstrap runs in background after React is already mounted.
// Fire-and-forget: any hang or error here is completely non-fatal.
(async () => {
  try {
    await migrateLocalStorageKeys();
    await restoreKeysToLocalStorage();
  } catch (e) {
    console.warn('[TradeEdge] Key bootstrap failed (non-fatal):', e);
  }
})();

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
        if (!code) return;
        try {
          await Browser.close();
          await exchangeSchwabCode(code);
          // Reload so Schwab routing kicks in immediately
          window.location.reload();
        } catch (e) {
          console.error('Schwab token exchange failed:', e);
        }
      });
    } catch {
      // @capacitor/app not available
    }
  })();
}
