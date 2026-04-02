import type { WatchlistGroup } from '../types';

const STORAGE_KEY = 'tradeedge_watchlists';

const DEFAULT_GROUPS: WatchlistGroup[] = [
  { id: 'g1', name: 'Indices',                      color: '#6366f1', position: 0, symbols: ['SPY', 'QQQ', 'DIA', 'IWM'] },
  { id: 'g2', name: 'AI Plays',                     color: '#8b5cf6', position: 1, symbols: ['NVDA', 'MSFT', 'GOOGL', 'META', 'PLTR'] },
  { id: 'g3', name: 'Dividend Kings',                color: '#22c55e', position: 2, symbols: [] },
  { id: 'g4', name: 'Earnings This Week',            color: '#f59e0b', position: 3, symbols: [] },
  { id: 'g5', name: 'Prof G · Investing Simplified', color: '#f97316', position: 4, symbols: ['VOO', 'SCHD', 'JEPI', 'VYM', 'O', 'VTI'] },
  { id: 'g6', name: 'Minority Mindset',              color: '#10b981', position: 5, symbols: ['VOO', 'VTI', 'VNQ', 'SCHD', 'BRK-B', 'MSFT'] },
  { id: 'g7', name: 'Steven Fiorillo',               color: '#06b6d4', position: 6, symbols: ['O', 'MAIN', 'JEPI', 'ABBV', 'BTI', 'MO', 'T', 'CVX', 'ENB', 'VZ'] },
  { id: 'g8', name: 'Amit Kukreja',                  color: '#f43f5e', position: 7, symbols: ['NVDA', 'META', 'AAPL', 'TSLA', 'AMD', 'MSFT', 'AMZN', 'GOOG'] },
];

function load(): WatchlistGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const groups = JSON.parse(raw) as WatchlistGroup[];
      // Seed any default groups added in newer versions
      const ids = new Set(groups.map((g) => g.id));
      let changed = false;
      for (const def of DEFAULT_GROUPS) {
        if (!ids.has(def.id)) {
          groups.push({ ...def, symbols: [...def.symbols] });
          changed = true;
        }
      }
      if (changed) save(groups);
      return groups;
    }
  } catch { /* ignore */ }
  return DEFAULT_GROUPS.map((g) => ({ ...g, symbols: [...g.symbols] }));
}

function save(groups: WatchlistGroup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

export async function fetchWatchlistsNative(): Promise<WatchlistGroup[]> {
  const groups = load();
  // Seed defaults on first run
  if (!localStorage.getItem(STORAGE_KEY)) save(groups);
  return groups;
}

export async function createWatchlistNative(name: string, color: string): Promise<WatchlistGroup> {
  const groups = load();
  const group: WatchlistGroup = {
    id: crypto.randomUUID(),
    name, color,
    position: groups.length,
    symbols: [],
  };
  save([...groups, group]);
  return group;
}

export async function updateWatchlistNative(
  id: string,
  updates: Partial<{ name: string; color: string; position: number }>
): Promise<WatchlistGroup> {
  const groups = load();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error('Group not found');
  groups[idx] = { ...groups[idx], ...updates };
  save(groups);
  return groups[idx];
}

export async function deleteWatchlistNative(id: string): Promise<void> {
  save(load().filter((g) => g.id !== id));
}

export async function addSymbolToWatchlistNative(groupId: string, symbol: string): Promise<void> {
  const groups = load();
  const group = groups.find((g) => g.id === groupId);
  if (group && !group.symbols.includes(symbol)) {
    group.symbols.push(symbol);
    save(groups);
  }
}

export async function removeSymbolFromWatchlistNative(groupId: string, symbol: string): Promise<void> {
  const groups = load();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.symbols = group.symbols.filter((s) => s !== symbol);
    save(groups);
  }
}
