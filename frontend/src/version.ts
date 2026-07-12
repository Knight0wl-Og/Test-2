// Injected at build time by vite.config.ts (define: __APP_VERSION__)
// from the repo-root package.json — the single source of truth.
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';
