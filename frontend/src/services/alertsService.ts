import type { Quote } from '../types';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  triggeredPrice?: number;
}

const STORAGE_KEY = 'tradeedge_alerts';

export function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function addAlert(symbol: string, targetPrice: number, direction: 'above' | 'below'): PriceAlert {
  const alert: PriceAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    symbol: symbol.toUpperCase(),
    targetPrice,
    direction,
    createdAt: Date.now(),
    triggered: false,
  };
  const alerts = loadAlerts();
  alerts.push(alert);
  saveAlerts(alerts);
  return alert;
}

export function removeAlert(id: string): void {
  const alerts = loadAlerts().filter((a) => a.id !== id);
  saveAlerts(alerts);
}

export function clearTriggeredAlerts(): void {
  const alerts = loadAlerts().filter((a) => !a.triggered);
  saveAlerts(alerts);
}

/**
 * Check quotes against active alerts; mark triggered ones.
 * Returns the list of newly triggered alerts (so callers can notify).
 */
export function checkAlerts(quotes: Quote[]): PriceAlert[] {
  const alerts = loadAlerts();
  const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));
  const newlyTriggered: PriceAlert[] = [];

  const updated = alerts.map((alert) => {
    if (alert.triggered) return alert;
    const price = priceMap.get(alert.symbol);
    if (price == null) return alert;
    const hit =
      (alert.direction === 'above' && price >= alert.targetPrice) ||
      (alert.direction === 'below' && price <= alert.targetPrice);
    if (hit) {
      const triggered = { ...alert, triggered: true, triggeredAt: Date.now(), triggeredPrice: price };
      newlyTriggered.push(triggered);
      return triggered;
    }
    return alert;
  });

  saveAlerts(updated);
  return newlyTriggered;
}
