import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Search, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { fetchOptions } from '../services/api';
import { useWatchlistStore } from '../store/watchlistStore';
import type { OptionsChain, OptionContract } from '../services/nativeOptions';

function fmt(n: number | null, d = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtVol(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toString();
}

function ContractRow({ contract, underlyingPrice }: { contract: OptionContract; underlyingPrice: number }) {
  const isITM = contract.inTheMoney;
  const spread = contract.ask > 0 ? contract.ask - contract.bid : null;

  return (
    <tr className={clsx('border-b border-border-dim/30 hover:bg-bg-hover transition-colors text-xs', isITM && 'bg-accent/5')}>
      <td className="px-2 py-1.5 text-right">
        <span className={clsx('font-semibold num', isITM ? 'text-accent' : 'text-gray-300')}>
          ${fmt(contract.strike)}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right text-gray-300 num">${fmt(contract.lastPrice)}</td>
      <td className="px-2 py-1.5 text-right text-gray-300 num">${fmt(contract.bid)}</td>
      <td className="px-2 py-1.5 text-right text-gray-300 num">${fmt(contract.ask)}</td>
      <td className="px-2 py-1.5 text-right text-text-muted num hidden sm:table-cell">
        {spread != null ? `$${fmt(spread)}` : '—'}
      </td>
      <td className="px-2 py-1.5 text-right text-text-muted num hidden md:table-cell">{fmtVol(contract.volume)}</td>
      <td className="px-2 py-1.5 text-right text-text-muted num hidden md:table-cell">{fmtVol(contract.openInterest)}</td>
      <td className="px-2 py-1.5 text-right text-text-muted num hidden lg:table-cell">
        {contract.impliedVolatility != null ? `${fmt(contract.impliedVolatility)}%` : '—'}
      </td>
      <td className="px-2 py-1.5 text-center hidden sm:table-cell">
        {isITM && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent font-medium">ITM</span>
        )}
      </td>
    </tr>
  );
}

function ContractTable({ contracts, underlyingPrice, type }: { contracts: OptionContract[]; underlyingPrice: number; type: 'calls' | 'puts' }) {
  const sorted = [...contracts].sort((a, b) => a.strike - b.strike);
  const color = type === 'calls' ? 'text-green' : 'text-red-400';
  const label = type === 'calls' ? 'Calls' : 'Puts';

  return (
    <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border-dim">
        <span className={clsx('text-xs font-semibold', color)}>{label}</span>
        <span className="text-xs text-text-muted ml-2">({sorted.length} contracts)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-dim text-[10px] text-text-muted">
              <th className="px-2 py-1.5 text-right font-medium">Strike</th>
              <th className="px-2 py-1.5 text-right font-medium">Last</th>
              <th className="px-2 py-1.5 text-right font-medium">Bid</th>
              <th className="px-2 py-1.5 text-right font-medium">Ask</th>
              <th className="px-2 py-1.5 text-right font-medium hidden sm:table-cell">Spread</th>
              <th className="px-2 py-1.5 text-right font-medium hidden md:table-cell">Volume</th>
              <th className="px-2 py-1.5 text-right font-medium hidden md:table-cell">OI</th>
              <th className="px-2 py-1.5 text-right font-medium hidden lg:table-cell">IV%</th>
              <th className="px-2 py-1.5 hidden sm:table-cell" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <ContractRow key={c.contractSymbol} contract={c} underlyingPrice={underlyingPrice} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-xs text-text-muted">No contracts</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Options() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(selectedSymbol ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol ?? '');
  const [selectedExpiry, setSelectedExpiry] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<'calls' | 'puts' | 'both'>('both');
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<OptionsChain>({
    queryKey: ['options', symbol, selectedExpiry],
    queryFn: () => fetchOptions(symbol, selectedExpiry),
    enabled: !!symbol,
    staleTime: 60_000,
    retry: 1,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const s = input.trim().toUpperCase();
    if (s) { setSymbol(s); setSelectedExpiry(undefined); }
  }

  function handleExpiryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedExpiry(val ? Number(val) : undefined);
  }

  return (
    <div className="p-4 space-y-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2">
        <LineChart className="w-4 h-4 text-accent" />
        <h1 className="text-base font-bold text-white">Options Chain</h1>
      </div>

      {/* Search row */}
      <div className="flex gap-2 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="Enter ticker…"
              className="w-full bg-bg-card border border-border-dim rounded pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-accent-hover text-white rounded px-4 py-1.5 text-sm font-medium transition-colors shrink-0"
          >
            Load
          </button>
        </form>

        {data && data.expirationDates.length > 0 && (
          <div className="relative">
            <select
              value={selectedExpiry ?? ''}
              onChange={handleExpiryChange}
              className="appearance-none bg-bg-card border border-border-dim rounded px-3 pr-7 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-accent"
            >
              {data.expirationDates.map((ts) => {
                const date = new Date(Number(ts) * 1000);
                const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return <option key={ts} value={ts}>{label}</option>;
              })}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          </div>
        )}
      </div>

      {/* Tab toggle */}
      {data && (
        <div className="flex items-center gap-3">
          <div className="flex bg-bg-card border border-border-dim rounded overflow-hidden text-xs">
            {(['both', 'calls', 'puts'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={clsx(
                  'px-3 py-1.5 capitalize transition-colors',
                  activeTab === t ? 'bg-accent text-white' : 'text-text-muted hover:text-gray-200'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-xs text-text-muted">
            Underlying: <span className="text-white font-semibold num">${fmt(data.underlyingPrice)}</span>
          </div>
          <button
            onClick={() => { useWatchlistStore.getState().selectSymbol(data.symbol); navigate('/'); }}
            className="text-xs text-accent hover:underline"
          >
            View chart →
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <div className="w-4 h-4 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
          <span className="text-sm">Loading options chain…</span>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-bg-card border border-red-900/40 rounded-lg p-4 text-sm text-red-400">
          Could not load options data for {symbol}. Options may not be available for this symbol.
        </div>
      )}

      {/* Chains */}
      {data && !isLoading && (
        <div className={clsx('gap-4', activeTab === 'both' ? 'grid grid-cols-1 xl:grid-cols-2' : 'space-y-4')}>
          {(activeTab === 'both' || activeTab === 'calls') && (
            <ContractTable contracts={data.calls} underlyingPrice={data.underlyingPrice} type="calls" />
          )}
          {(activeTab === 'both' || activeTab === 'puts') && (
            <ContractTable contracts={data.puts} underlyingPrice={data.underlyingPrice} type="puts" />
          )}
        </div>
      )}

      {!symbol && !isLoading && (
        <div className="bg-bg-card border border-border-dim rounded-lg p-8 text-center space-y-2">
          <LineChart className="w-8 h-8 text-text-muted/40 mx-auto" />
          <p className="text-sm text-text-muted">Enter a ticker to load its options chain</p>
          <p className="text-xs text-text-muted/60">ITM contracts are highlighted. Blue = in the money.</p>
        </div>
      )}
    </div>
  );
}
