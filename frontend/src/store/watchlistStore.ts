import { create } from 'zustand';
import type { WatchlistGroup } from '../types';
import {
  fetchWatchlists,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  addSymbolToWatchlist,
  removeSymbolFromWatchlist,
} from '../services/api';

interface WatchlistStore {
  groups: WatchlistGroup[];
  selectedSymbol: string | null;
  loading: boolean;

  // Actions
  loadGroups: () => Promise<void>;
  selectSymbol: (symbol: string) => void;
  addGroup: (name: string, color: string) => Promise<void>;
  renameGroup: (id: string, name: string) => Promise<void>;
  removeGroup: (id: string) => Promise<void>;
  addSymbol: (groupId: string, symbol: string) => Promise<void>;
  removeSymbol: (groupId: string, symbol: string) => Promise<void>;

  // All symbols across all groups (for batch quote fetching)
  allSymbols: () => string[];
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  groups: [],
  selectedSymbol: null,
  loading: false,

  loadGroups: async () => {
    set({ loading: true });
    try {
      const groups = await fetchWatchlists();
      set({ groups, loading: false });
      // Auto-select first symbol if none selected
      if (!get().selectedSymbol && groups.length > 0 && groups[0].symbols.length > 0) {
        set({ selectedSymbol: groups[0].symbols[0] });
      }
    } catch (err) {
      console.error('Failed to load watchlists:', err);
      set({ loading: false });
    }
  },

  selectSymbol: (symbol) => set({ selectedSymbol: symbol }),

  addGroup: async (name, color) => {
    const group = await createWatchlist(name, color);
    set((state) => ({ groups: [...state.groups, group] }));
  },

  renameGroup: async (id, name) => {
    await updateWatchlist(id, { name });
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, name } : g)),
    }));
  },

  removeGroup: async (id) => {
    await deleteWatchlist(id);
    set((state) => ({ groups: state.groups.filter((g) => g.id !== id) }));
  },

  addSymbol: async (groupId, symbol) => {
    const upper = symbol.toUpperCase();
    await addSymbolToWatchlist(groupId, upper);
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId && !g.symbols.includes(upper)
          ? { ...g, symbols: [...g.symbols, upper] }
          : g
      ),
    }));
  },

  removeSymbol: async (groupId, symbol) => {
    await removeSymbolFromWatchlist(groupId, symbol);
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, symbols: g.symbols.filter((s) => s !== symbol) } : g
      ),
    }));
  },

  allSymbols: () => {
    const all = new Set<string>();
    get().groups.forEach((g) => g.symbols.forEach((s) => all.add(s)));
    return Array.from(all);
  },
}));
