import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useNetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Use @capacitor/network on native
      let cleanup: (() => void) | undefined;

      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          // Get initial status
          const status = await Network.getStatus();
          setOnline(status.connected);

          // Listen for changes
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setOnline(s.connected);
          });

          cleanup = () => { handle.remove(); };
        } catch {
          // plugin not available — assume online
        }
      })();

      return () => { cleanup?.(); };
    } else {
      // Web: use browser navigator.onLine events
      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);

      setOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return { online };
}
