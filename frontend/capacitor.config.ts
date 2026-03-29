import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradeedge.app',
  appName: 'TradeEdge',
  webDir: 'dist',
  server: {
    // In production APK, point to your deployed backend URL
    // For local dev over WiFi, use your machine's local IP
    // Example: 'http://192.168.1.100:3001'
    // Leave empty to bundle web assets locally (requires offline mode)
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: 'tradeedge.keystore',
      keystoreAlias: 'tradeedge',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0f',
      showSpinner: true,
      spinnerColor: '#6366f1',
    },
  },
};

export default config;
