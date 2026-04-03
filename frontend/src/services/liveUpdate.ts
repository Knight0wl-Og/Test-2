import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

const GITHUB_REPO = 'Knight0wl-Og/Test-2';

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
 * Check GitHub Releases for a newer bundle.zip, download and apply it.
 * Runs silently in the background — reloads the app if an update is found.
 */
export async function checkForUpdates(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const res = await CapacitorHttp.get({
      url: `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (res.status !== 200) return;

    const release = res.data;

    // Use the bundle.zip asset's updated_at as the version ID so that every
    // new upload (even to the same release tag) is detected as an update.
    const asset = (release.assets as Array<{
      name: string;
      browser_download_url: string;
      updated_at: string;
    }>).find((a) => a.name === 'bundle.zip');
    if (!asset) return;

    const bundleVersion = asset.updated_at; // e.g. "2026-04-03T18:00:00Z"

    // Compare with currently running bundle
    const { bundleId: currentBundleId } = await LiveUpdate.getCurrentBundle();
    if (currentBundleId === bundleVersion) return; // already up to date

    // Download, stage, and apply
    await LiveUpdate.downloadBundle({ bundleId: bundleVersion, url: asset.browser_download_url });
    await LiveUpdate.setNextBundle({ bundleId: bundleVersion });
    await LiveUpdate.reload();
  } catch (err) {
    console.warn('[liveUpdate] update check failed:', err);
  }
}
