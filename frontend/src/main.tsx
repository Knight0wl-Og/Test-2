import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { confirmBundle } from './services/liveUpdate';
import { syncEarningsWatchlist } from './services/earningsSync';

// Confirm the running bundle is stable (prevents auto-rollback on crash)
confirmBundle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Sync earnings calendar into the watchlist 2s after mount (non-blocking)
setTimeout(syncEarningsWatchlist, 2000);
