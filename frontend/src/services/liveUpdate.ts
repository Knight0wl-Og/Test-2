import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { APP_VERSION } from '../version';

const GITHUB_REPO = 'Knight0wl-Og/Test-2';

/** Numeric semver compare: 1 if a > b, -1 if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * If the APK was updated while an older OTA bundle was active, the plugin
 * keeps serving the stale bundle — the app would show the old version
 * forever. Detect that (native version newer than the running JS bundle)
 * and reset to the APK's built-in bundle.
 * An OTA bundle that is intentionally NEWER than the APK is left alone.
 */
export async function resetStaleOtaBundle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    if (info.version && compareVersions(info.version, APP_VERSION) > 0) {
      console.info(`[liveUpdate] APK ${info.version} is newer than running bundle ${APP_VERSION} — resetting to built-in bundle`);
      await LiveUpdate.reset();
      await LiveUpdate.reload();
    }
  } catch (err) {
    console.warn('[liveUpdate] stale-bundle check failed (non-fatal):', err);
  }
}

export type UpdateState =
  | 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error'
  | 'apk-available' | 'apk-downloading' | 'apk-ready';

export interface UpdateProgress {
  state: UpdateState;
  progress: number; // 0–100
  message?: string;
  /** Set when state is apk-available/apk-downloading/apk-ready */
  apk?: { version: string; url: string; sizeMB: number };
}

/**
 * Call once on app mount to confirm the current bundle is working.
 * Prevents rollback to the previous bundle.
 */
export async function confirmBundle(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LiveUpdate.ready();
  } catch (err) {
    console.warn('[liveUpdate] ready() failed:', err);
  }
}

/**
 * Check GitHub Releases for updates.
 * - If the release version is newer than the installed APK, offer a FULL
 *   app update (state 'apk-available') — the caller then invokes
 *   downloadAndInstallApk() which hands the APK to Android's installer.
 * - Otherwise falls back to the OTA bundle flow (JS-only update):
 *   downloads bundle.zip and stages it; call applyUpdate() after 'ready'.
 */
export async function checkAndDownload(
  onUpdate: (p: UpdateProgress) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  onUpdate({ state: 'checking', progress: 0 });

  try {
    const res = await CapacitorHttp.get({
      url: `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (res.status === 404) {
      onUpdate({ state: 'error', progress: 0, message: 'No release found yet. Try again later.' });
      return;
    }
    if (res.status === 403) {
      onUpdate({ state: 'error', progress: 0, message: 'Rate limited by GitHub. Wait a few minutes and try again.' });
      return;
    }
    if (res.status !== 200) {
      onUpdate({ state: 'error', progress: 0, message: `Update server returned an unexpected response (${res.status}).` });
      return;
    }

    const release = res.data;
    const assets = release.assets as Array<{ name: string; browser_download_url: string; updated_at: string; size: number }>;

    // ── Full APK update: release tag newer than the installed app? ──
    const latestVersion = String(release.tag_name ?? '').replace(/^v/, '');
    const apkAsset = assets.find((a) => a.name === 'TradeEdge.apk');
    if (latestVersion && apkAsset) {
      try {
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        if (info.version && compareVersions(latestVersion, info.version) > 0) {
          onUpdate({
            state: 'apk-available',
            progress: 0,
            apk: {
              version: latestVersion,
              url: apkAsset.browser_download_url,
              sizeMB: Math.round((apkAsset.size / 1e6) * 10) / 10,
            },
          });
          return;
        }
      } catch (err) {
        console.warn('[liveUpdate] APK version check failed, falling back to bundle:', err);
      }
    }

    // ── OTA bundle update (JS-only) ──
    const asset = assets.find((a) => a.name === 'bundle.zip');

    if (!asset) {
      onUpdate({ state: 'error', progress: 0, message: 'No update bundle found in this release.' });
      return;
    }

    const bundleVersion = asset.updated_at;
    const { bundleId: currentBundleId } = await LiveUpdate.getCurrentBundle();

    if (currentBundleId === bundleVersion) {
      onUpdate({ state: 'up-to-date', progress: 100 });
      return;
    }

    // Animate progress while the real download runs in the background
    onUpdate({ state: 'downloading', progress: 0 });
    let sim = 0;
    const ticker = setInterval(() => {
      sim = Math.min(sim + Math.random() * 7 + 1, 85);
      onUpdate({ state: 'downloading', progress: Math.round(sim) });
    }, 350);

    try {
      await LiveUpdate.downloadBundle({ bundleId: bundleVersion, url: asset.browser_download_url });
      clearInterval(ticker);
      await LiveUpdate.setNextBundle({ bundleId: bundleVersion });
      onUpdate({ state: 'ready', progress: 100 });
    } catch {
      clearInterval(ticker);
      onUpdate({ state: 'error', progress: 0, message: 'Download failed. Please try again.' });
    }
  } catch {
    onUpdate({ state: 'error', progress: 0, message: 'Network error — check your connection and try again.' });
  }
}

/**
 * Reload the app to apply a staged bundle (call after state === 'ready').
 */
export async function applyUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LiveUpdate.reload();
  } catch (err) {
    console.warn('[liveUpdate] reload failed:', err);
  }
}

/**
 * Download the release APK from GitHub and hand it to Android's package
 * installer. Because every release is signed with the same permanent key,
 * the installer shows a simple "Update" prompt and the whole app (native
 * shell + JS) updates in place — no uninstall.
 *
 * The first time, Android asks the user to allow "install unknown apps"
 * for TradeEdge; after that it's one tap.
 */
export async function downloadAndInstallApk(
  apk: { version: string; url: string; sizeMB: number },
  onUpdate: (p: UpdateProgress) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  onUpdate({ state: 'apk-downloading', progress: 0, apk });

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const listener = await Filesystem.addListener('progress', (p) => {
      if (p.contentLength > 0) {
        onUpdate({
          state: 'apk-downloading',
          progress: Math.min(Math.round((p.bytes / p.contentLength) * 100), 100),
          apk,
        });
      }
    });

    let filePath: string | undefined;
    try {
      const result = await Filesystem.downloadFile({
        url: apk.url,
        path: `TradeEdge-${apk.version}.apk`,
        directory: Directory.Cache,
        progress: true,
      });
      filePath = result.path;
    } finally {
      await listener.remove();
    }

    if (!filePath) throw new Error('Download produced no file');

    onUpdate({ state: 'apk-ready', progress: 100, apk });

    const { FileOpener } = await import('@capacitor-community/file-opener');
    await FileOpener.open({
      filePath,
      contentType: 'application/vnd.android.package-archive',
    });
  } catch (err) {
    console.warn('[liveUpdate] APK update failed:', err);
    onUpdate({
      state: 'error',
      progress: 0,
      message: 'Full update failed — check your connection and try again, or download the APK from GitHub manually.',
    });
  }
}
