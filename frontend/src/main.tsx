import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { confirmBundle } from './services/liveUpdate';
import { migrateLocalStorageKeys, restoreKeysToLocalStorage, KEY_NAMES } from './services/keyStorage';
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
// If the async restore brings back keys that weren't in localStorage yet
// (fresh install over an OTA/persistent store), reload once so pages that
// checked hasFmpKey()/hasFinnhubKey() at render pick them up.
(async () => {
  try {
    const before = new Set(KEY_NAMES.filter((k) => localStorage.getItem(k)));
    await migrateLocalStorageKeys();
    await restoreKeysToLocalStorage();
    const restored = KEY_NAMES.some((k) => !before.has(k) && localStorage.getItem(k));
    const GUARD = 'tradeedge_keys_reloaded';
    if (restored && !sessionStorage.getItem(GUARD)) {
      sessionStorage.setItem(GUARD, '1');
      window.location.reload();
    }
  } catch (e) {
    console.warn('[TradeEdge] Key bootstrap failed (non-fatal):', e);
  }
})();

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
