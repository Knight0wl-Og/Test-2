import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useOptions } from '../../hooks/useOptions';
import type { OptionContract } from '../../services/nativeOptions';

interface OptionsPanelProps {
  symbol: string;
  underlyingPrice?: number;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtK(n: number | null) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function isUnusual(c: OptionContract): boolean {
  if (!c.volume || !c.openInterest) return false;
  return c.volume > c.openInterest * 0.5 && c.volume > 500;
}

function ContractRow({ c, price }: { c: OptionContract; price: number }) {
  const unusual = isUnusual(c);
  const itm = c.inTheMoney;
  const spread = c.ask - c.bid;

  return (
    <tr className={clsx('border-b border-panel text-[10px] font-mono', itm ? 'bg-accent/5' : 'hover:bg-bg-hover/50')}>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1">
          {unusual && <Zap className="w-2.5 h-2.5 text-yellow-400 shrink-0" />}
          <span className={clsx('font-semibold', itm ? 'text-accent' : 'text-gray-300')}>
            {fmt(c.strike)}
          </span>
          {itm && <span className="text-[9px] text-accent/70 ml-0.5">ITM</span>}
        </div>
      </td>
      <td className="px-2 py-1 text-green-400">{fmt(c.bid)}</td>
      <td className="px-2 py-1 text-red-400">{fmt(c.ask)}</td>
      <td className="px-2 py-1 text-gray-300">{fmt(spread)}</td>
      <td className="px-2 py-1 text-gray-400">{fmt(c.lastPrice)}</td>
      <td className="px-2 py-1 text-blue-300">{fmtK(c.volume)}</td>
      <td className="px-2 py-1 text-purple-300">{fmtK(c.openInterest)}</td>
      <td className="px-2 py-1 text-yellow-300">
        {c.impliedVolatility != null ? `${fmt(c.impliedVolatility)}%` : '—'}
      </td>
      <td className="px-2 py-1 text-text-muted text-[9px]">
        {c.volume && c.openInterest ? fmt(c.volume / c.openInterest, 2) : '—'}
      </td>
    </tr>
  );
}

const HEADERS = ['Strike', 'Bid', 'Ask', 'Sprd', 'Last', 'Vol', 'OI', 'IV%', 'V/OI'];

export function OptionsPanel({ symbol, underlyingPrice }: OptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'calls' | 'puts'>('calls');
  const [selectedExp, setSelectedExp] = useState<number | undefined>(undefined);

  const { data, isLoading, error } = useOptions(open ? symbol : null, selectedExp);

  const activePrice = underlyingPrice ?? data?.underlyingPrice ?? 0;

  // Sort by proximity to underlying price (ATM first)
  const contracts: OptionContract[] = useMemo(() => {
    const list = tab === 'calls' ? (data?.calls ?? []) : (data?.puts ?? []);
    return [...list].sort((a, b) => Math.abs(a.strike - activePrice) - Math.abs(b.strike - activePrice));
  }, [data, tab, activePrice]);

  // Put/Call ratio
  const pcRatio = useMemo(() => {
    if (!data) return null;
    const callOI = data.calls.reduce((s, c) => s + (c.openInterest ?? 0), 0);
    const putOI = data.puts.reduce((s, c) => s + (c.openInterest ?? 0), 0);
    return callOI > 0 ? putOI / callOI : null;
  }, [data]);

  // Unusual activity count
  const unusualCount = contracts.filter(isUnusual).length;

  // Format expiration dates for selector
  const expDates = data?.expirationDates ?? [];

  return (
    <div className="border-t border-panel bg-bg-secondary shrink-0">
      {/* Header bar */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 h-7 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-300">Options Chain</span>
          {data && (
            <>
              {pcRatio != null && (
                <span className={clsx('text-[10px] font-mono', pcRatio > 1 ? 'text-red-400' : 'text-green-400')}>
                  P/C {fmt(pcRatio, 2)}
                </span>
              )}
              {unusualCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                  <Zap className="w-3 h-3" /> {unusualCount} unusual
                </span>
              )}
            </>
          )}
          {!data && !isLoading && !error && (
            <span className="text-[10px] text-text-muted">click to load</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">~15m delayed</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronUp className="w-3.5 h-3.5 text-text-muted" />}
        </div>
      </button>

      {open && (
        <div className="max-h-64 flex flex-col">
          {/* Controls row */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-panel shrink-0">
            {/* Calls / Puts tabs */}
            <div className="flex rounded overflow-hidden text-[10px] border border-panel">
              <button
                onClick={() => setTab('calls')}
                className={clsx('px-3 py-0.5 transition-colors', tab === 'calls' ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-gray-300')}
              >
                Calls
              </button>
              <button
                onClick={() => setTab('puts')}
                className={clsx('px-3 py-0.5 transition-colors', tab === 'puts' ? 'bg-red-500/20 text-red-400' : 'text-text-muted hover:text-gray-300')}
              >
                Puts
              </button>
            </div>

            {/* Expiration selector */}
            {expDates.length > 0 && (
              <select
                value={selectedExp ?? ''}
                onChange={(e) => setSelectedExp(e.target.value ? Number(e.target.value) : undefined)}
                className="bg-bg-hover border border-panel rounded px-2 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-accent"
              >
                <option value="">Nearest expiry</option>
                {expDates.map((ts) => (
                  <option key={ts} value={ts}>
                    {new Date(Number(ts) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </option>
                ))}
              </select>
            )}

            {activePrice > 0 && (
              <span className="text-[10px] text-text-muted ml-auto">
                Underlying: <span className="text-gray-300 font-mono">{fmt(activePrice)}</span>
              </span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            {isLoading && (
              <div className="flex items-center justify-center h-20">
                <div className="w-4 h-4 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-20 text-[11px] text-text-muted">
                Failed to load options data
              </div>
            )}
            {!isLoading && !error && contracts.length > 0 && (
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-panel sticky top-0 bg-bg-secondary">
                    {HEADERS.map((h) => (
                      <th key={h} className="px-2 py-1 text-left text-[9px] font-semibold text-text-muted uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <ContractRow key={c.contractSymbol} c={c} price={activePrice} />
                  ))}
                </tbody>
              </table>
            )}
            {!isLoading && !error && contracts.length === 0 && data && (
              <div className="flex items-center justify-center h-20 text-[11px] text-text-muted">
                No contracts available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
