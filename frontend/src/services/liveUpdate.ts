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
    const latestTag: string = release.tag_name; // e.g. "v1.0.2"

    // Compare with currently running bundle
    const { bundleId: currentBundleId } = await LiveUpdate.getCurrentBundle();
    if (currentBundleId === latestTag) return; // already up to date

    // Find bundle.zip in the release assets
    const asset = (release.assets as Array<{ name: string; browser_download_url: string }>)
      .find((a) => a.name === 'bundle.zip');
    if (!asset) return;

    // Download, stage, and apply
    await LiveUpdate.downloadBundle({ bundleId: latestTag, url: asset.browser_download_url });
    await LiveUpdate.setNextBundle({ bundleId: latestTag });
    await LiveUpdate.reload();
  } catch (err) {
    console.warn('[liveUpdate] update check failed:', err);
  }
}
