import { Capacitor } from '@capacitor/core';

/**
 * Light tap haptic — use for nav taps, selections, minor interactions.
 */
export async function tap(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // plugin not available — silent no-op
  }
}

/**
 * Medium impact — use for confirmations, alert creation, destructive actions.
 */
export async function impact(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // plugin not available — silent no-op
  }
}
