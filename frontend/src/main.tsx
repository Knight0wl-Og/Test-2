import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { confirmBundle, checkForUpdates } from './services/liveUpdate';
import { syncEarningsWatchlist } from './services/earningsSync';

// Confirm the running bundle is good (prevents auto-rollback)
confirmBundle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Sync earnings calendar to watchlist (non-blocking, 2s after mount)
setTimeout(syncEarningsWatchlist, 2000);
// Check for OTA updates (non-blocking, 4s after mount)
setTimeout(checkForUpdates, 4000);
