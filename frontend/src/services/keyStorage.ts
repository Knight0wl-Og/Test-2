/**
 * keyStorage — unified API key persistence layer.
 *
 * Priority order:
 *  1. Desktop (Electron): window.electronAPI IPC → electron-store JSON file
 *     → survives app reinstalls, stored in %APPDATA%/TradeEdge/
 *  2. Android (Capacitor native): @capacitor/preferences
 *     → survives APK reinstalls on same device
 *  3. Web / fallback: localStorage
 *
 * All functions are async to accommodate the IPC and native layers.
 * On first launch after migration, existing localStorage values are
 * automatically promoted to the persistent store.
 */

import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    electronAPI?: {
      getKey: (name: string) => Promise<string>;
      setKey: (name: string, value: string) => Promise<void>;
      deleteKey: (name: string) => Promise<void>;
      clearAllKeys: () => Promise<void>;
      getAllKeys: () => Promise<Record<string, string>>;
    };
  }
}

// All key names used across the app
export const KEY_NAMES = [
  'tradeedge_fmp_key',
  'TRADEEDGE_FINNHUB_KEY',
  'TRADEEDGE_POLYGON_KEY',
  'TRADEEDGE_GEMINI_KEY',
  'TRADEEDGE_GROQ_KEY',
  'TRADEEDGE_ANTHROPIC_KEY',
  'TRADEEDGE_SCHWAB_CLIENT_ID',
  'TRADEEDGE_SCHWAB_CLIENT_SECRET',
  'SCHWAB_ACCESS_TOKEN',
  'SCHWAB_REFRESH_TOKEN',
  'SCHWAB_TOKEN_EXPIRY',
  'TRADEEDGE_API_URL',
  'tradeedge_watermark',
] as const;

export type KeyName = typeof KEY_NAMES[number];

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

// Lazy import for Capacitor Preferences (only available on native)
async function getPreferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

// ─── Core read/write ──────────────────────────────────────────────────────────

export async function getKey(name: string): Promise<string> {
  if (isElectron()) {
    return (await window.electronAPI!.getKey(name)) ?? '';
  }
  if (isNativeAndroid()) {
    const Preferences = await getPreferences();
    const { value } = await Preferences.get({ key: name });
    return value ?? '';
  }
  return localStorage.getItem(name) ?? '';
}

export async function setKey(name: string, value: string): Promise<void> {
  // Always mirror into localStorage so synchronous readers (getFmpKey, etc.) work immediately
  if (value) {
    localStorage.setItem(name, value);
  } else {
    localStorage.removeItem(name);
  }

  if (isElectron()) {
    if (value) {
      await window.electronAPI!.setKey(name, value);
    } else {
      await window.electronAPI!.deleteKey(name);
    }
    return;
  }
  if (isNativeAndroid()) {
    const Preferences = await getPreferences();
    if (value) {
      await Preferences.set({ key: name, value });
    } else {
      await Preferences.remove({ key: name });
    }
    return;
  }
  // Web: already written to localStorage above
}

export async function deleteKey(name: string): Promise<void> {
  await setKey(name, '');
}

export async function clearAllKeys(): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.clearAllKeys();
    return;
  }
  if (isNativeAndroid()) {
    const Preferences = await getPreferences();
    await Preferences.clear();
    return;
  }
  KEY_NAMES.forEach((k) => localStorage.removeItem(k));
}

// ─── Migration ────────────────────────────────────────────────────────────────

const MIGRATION_FLAG = 'tradeedge_keys_migrated_v1';

/**
 * Run once on app start: promote any localStorage values into the
 * persistent store (electron-store or @capacitor/preferences).
 * Safe to call multiple times — skips if already migrated.
 */
export async function migrateLocalStorageKeys(): Promise<void> {
  if (!isElectron() && !isNativeAndroid()) return; // nothing to migrate on web
  if (localStorage.getItem(MIGRATION_FLAG)) return; // already done

  for (const name of KEY_NAMES) {
    const existing = localStorage.getItem(name);
    if (existing) {
      const stored = await getKey(name);
      if (!stored) {
        await setKey(name, existing);
      }
    }
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
}

// ─── Sync helpers (for components that still use synchronous patterns) ────────

/**
 * Returns all keys as a plain object. Components can call this once on
 * mount and keep the result in state.
 */
export async function loadAllKeys(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    KEY_NAMES.map(async (name) => {
      result[name] = await getKey(name);
    })
  );
  return result;
}

/**
 * On Electron / Android: reads all persisted keys back into localStorage so
 * that synchronous readers (getFmpKey, etc.) have values immediately on app
 * start — including after a reinstall where localStorage was wiped.
 * On web this is a fast no-op.
 */
export async function restoreKeysToLocalStorage(): Promise<void> {
  if (!isElectron() && !isNativeAndroid()) return;
  const keys = await loadAllKeys();
  for (const [name, value] of Object.entries(keys)) {
    if (value) localStorage.setItem(name, value);
  }
}
