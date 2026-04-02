import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { confirmBundle, checkForUpdates } from './services/liveUpdate';

// Confirm the running bundle is good (prevents auto-rollback)
confirmBundle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Check for updates after the app has mounted (non-blocking)
setTimeout(checkForUpdates, 4000);
