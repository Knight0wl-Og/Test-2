import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

const GITHUB_REPO = 'Knight0wl-Og/Test-2';

export type UpdateState = 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error';

export interface UpdateProgress {
  state: UpdateState;
  progress: number; // 0–100
  message?: string;
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
 * Check GitHub Releases for a newer bundle.zip, download it, and stage it.
 * Reports progress via the onUpdate callback.
 * Call applyUpdate() to reload and apply after state === 'ready'.
 */
export async function checkAndDownload(
  onUpdate: (p: UpdateProgress) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  onUpdate({ state: 'checking', progress: 0 });

  try {
    const ghToken = localStorage.getItem('TRADEEDGE_GH_TOKEN');
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

    const res = await CapacitorHttp.get({
      url: `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      headers,
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
    const asset = (
      release.assets as Array<{ id: number; name: string; browser_download_url: string; updated_at: string }>
    ).find((a) => a.name === 'bundle.zip');

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

    // Resolve download URL — for private repos, browser_download_url requires auth which
    // LiveUpdate.downloadBundle doesn't support. Use the GitHub asset API with
    // disableRedirects to capture the pre-signed CDN URL (no auth required).
    let downloadUrl = asset.browser_download_url;
    if (ghToken) {
      try {
        const redirect = await CapacitorHttp.get({
          url: `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`,
          headers: {
            Accept: 'application/octet-stream',
            Authorization: `Bearer ${ghToken}`,
          },
          disableRedirects: true,
        });
        const location = redirect.headers?.['location'] ?? redirect.headers?.['Location'];
        if ((redirect.status === 302 || redirect.status === 301) && location) {
          downloadUrl = location;
        }
      } catch {
        // Fall back to browser_download_url
      }
    }

    // Animate progress while the real download runs in the background
    onUpdate({ state: 'downloading', progress: 0 });
    let sim = 0;
    const ticker = setInterval(() => {
      sim = Math.min(sim + Math.random() * 7 + 1, 85);
      onUpdate({ state: 'downloading', progress: Math.round(sim) });
    }, 350);

    try {
      await LiveUpdate.downloadBundle({ bundleId: bundleVersion, url: downloadUrl });
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
