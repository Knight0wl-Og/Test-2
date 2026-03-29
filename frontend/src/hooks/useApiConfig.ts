import { useEffect, useState } from 'react';

function isCapacitor(): boolean {
  return typeof (window as any).Capacitor !== 'undefined';
}

export function useApiBaseUrl(): string {
  const [baseUrl, setBaseUrl] = useState(
    import.meta.env.VITE_API_URL || 'http://localhost:3001'
  );

  useEffect(() => {
    if (isCapacitor()) {
      // When running as Android APK, read from localStorage override
      // or fall back to env var set at build time
      const override = localStorage.getItem('TRADEEDGE_API_URL');
      if (override) setBaseUrl(override);
    }
  }, []);

  return baseUrl;
}
