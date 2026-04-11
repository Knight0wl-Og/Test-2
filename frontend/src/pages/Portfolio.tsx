import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Briefcase, RefreshCw, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBatchQuotes } from '../services/api';
import {
  isSchwabConnected,
  fetchSchwabAccounts,
  fetchSchwabPositions,
  type SchwabAccount,
  type SchwabPosition,
} from '../services/schwabService';
import { useWatchlistStore } from '../store/watchlistStore';
import { AddPositionModal, type Position } from '../components/portfolio/AddPositionModal';
import type { Quote } from '../types';

const STORAGE_KEY = 'tradeedge_portfolio';

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePositions(positions: Position[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtCurrency(n: number) {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : '+'}$${fmt(abs)}`;
}

export function Portfolio() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const queryClient = useQueryClient();

  // Manual positions (used when Schwab not connected)
  const [manualPositions, setManualPositions] = useState<Position[]>(() => loadPositions());
  const [showAdd, setShowAdd] = useState(false);

  const schwabConnected = isSchwabConnected();

  // ── Schwab: accounts ──────────────────────────────────────────────────────
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<SchwabAccount[]>({
    queryKey: ['schwab-accounts'],
    queryFn: fetchSchwabAccounts,
    enabled: schwabConnected,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const primaryAccount = accounts[0] ?? null;

  // ── Schwab: positions ─────────────────────────────────────────────────────
  const { data: schwabPositions = [], isLoading: posLoading } = useQuery<SchwabPosition[]>({
    queryKey: ['schwab-positions', primaryAccount?.accountNumber],
    queryFn: () => fetchSchwabPositions(primaryAccount!.accountNumber),
    enabled: schwabConnected && !!primaryAccount?.accountNumber,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // ── Determine which positions to show ────────────────────────────────────
  const usingLive = schwabConnected && schwabPositions.length > 0;

  const symbols = useMemo(() => {
    if (usingLive) return schwabPositions.map((p) => p.symbol);
    return [...new Set(manualPositions.map((p) => p.symbol))];
  }, [usingLive, schwabPositions, manualPositions]);

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ['portfolio-quotes', symbols.join(',')],
    queryFn: () => fetchBatchQuotes(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const priceMap = useMemo(() => new Map(quotes.map((q) => [q.symbol, q])), [quotes]);
  const isLoading = accountsLoading || posLoading || quotesLoading;

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (usingLive) {
      return schwabPositions.map((pos) => {
        const q = priceMap.get(pos.symbol);
        const currentPrice = q?.price ?? null;
        const marketValue = pos.marketValue > 0 ? pos.marketValue : (currentPrice != null ? currentPrice * pos.longQuantity : null);
        const costBasis = pos.averagePrice * pos.longQuantity;
        const pnl = marketValue != null ? marketValue - costBasis : null;
        const pnlPct = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
        return {
          id: pos.symbol,
          symbol: pos.symbol,
          shares: pos.longQuantity,
          avgCost: pos.averagePrice,
          currentPrice,
          marketValue,
          costBasis,
          pnl,
          pnlPct,
          quote: q,
        };
      });
    }
    return manualPositions.map((pos) => {
      const q = priceMap.get(pos.symbol);
      const currentPrice = q?.price ?? null;
      const marketValue = currentPrice != null ? currentPrice * pos.shares : null;
      const costBasis = pos.avgCost * pos.shares;
      const pnl = marketValue != null ? marketValue - costBasis : null;
      const pnlPct = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
      return { ...pos, currentPrice, marketValue, costBasis, pnl, pnlPct, quote: q };
    });
  }, [usingLive, schwabPositions, manualPositions, priceMap]);

  const totalValue = rows.reduce((s, r) => s + (r.marketValue ?? r.costBasis), 0);
  const totalCost = rows.reduce((s, r) => s + r.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  function handleAddPosition(pos: Position) {
    const next = [...manualPositions, pos];
    setManualPositions(next);
    savePositions(next);
  }

  function removeManualPosition(id: string) {
    const next = manualPositions.filter((p) => p.id !== id);
    setManualPositions(next);
    savePositions(next);
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['schwab-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['schwab-positions'] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-quotes'] });
  }

  return (
    <div className="p-4 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-accent" />
        <h1 className="text-sm font-semibold text-white">Portfolio</h1>
        {usingLive && (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
            <Wifi className="w-2.5 h-2.5" /> Live
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {schwabConnected && (
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded text-text-muted hover:text-white hover:bg-bg-hover transition-colors"
              title="Refresh"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            </button>
          )}
          {!usingLive && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Position
            </button>
          )}
        </div>
      </div>

      {/* ── Account summary (Schwab) ── */}
      {schwabConnected && primaryAccount && (
        <div className="bg-bg-card border border-border-dim rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Cash Balance</p>
            <p className="text-base font-bold text-white num">${fmt(primaryAccount.cashBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">Account Value</p>
            <p className="text-base font-bold text-white num">${fmt(primaryAccount.totalValue)}</p>
          </div>
        </div>
      )}

      {/* ── P&L summary ── */}
      {rows.length > 0 && (
        <div className="bg-bg-card border border-border-dim rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Holdings Value</p>
            <p className="text-base font-bold text-white num">${fmt(totalValue)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">Cost Basis</p>
            <p className="text-base font-bold text-gray-300 num">${fmt(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">Total P&amp;L</p>
            <p className={clsx('text-base font-bold num', totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
              {fmtCurrency(totalPnl)}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-0.5">Total Return</p>
            <p className={clsx('text-base font-bold num', totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>
              {totalPnlPct >= 0 ? '+' : ''}{fmt(totalPnlPct)}%
            </p>
          </div>
        </div>
      )}

      {/* ── Positions table ── */}
      <div className="bg-bg-card border border-border-dim rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Briefcase className="w-8 h-8 text-text-muted/40 mx-auto" />
            {isLoading ? (
              <p className="text-sm text-text-muted">Loading positions…</p>
            ) : schwabConnected ? (
              <>
                <p className="text-sm text-text-muted">No equity positions found</p>
                <p className="text-xs text-text-muted/60">Schwab account connected — positions will appear here</p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-muted">No positions yet</p>
                <p className="text-xs text-text-muted/60">Connect Schwab in Settings for live data, or add positions manually</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-dim">
                  <th className="text-left px-3 py-2.5 text-text-muted font-medium">Symbol</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-medium">Shares</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-medium hidden sm:table-cell">Avg Cost</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-medium">Price</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-medium hidden sm:table-cell">Mkt Value</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-medium">P&amp;L</th>
                  <th className="text-right px-3 py-2.5 text-text-muted font-medium">Return</th>
                  {!usingLive && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pnlPos = (row.pnl ?? 0) >= 0;
                  return (
                    <tr key={row.id} className="border-b border-border-dim/40 hover:bg-bg-hover transition-colors">
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => { selectSymbol(row.symbol); navigate('/'); }}
                          className="font-semibold text-white hover:text-accent transition-colors"
                        >
                          {row.symbol}
                        </button>
                        {row.quote && (
                          <p className="text-[10px] text-text-muted truncate max-w-[80px]">{row.quote.shortName}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-300 num">{fmt(row.shares, row.shares % 1 === 0 ? 0 : 3)}</td>
                      <td className="px-3 py-2.5 text-right text-text-muted num hidden sm:table-cell">${fmt(row.avgCost)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-200 num">
                        {quotesLoading ? (
                          <div className="h-3 bg-bg-hover rounded w-14 ml-auto animate-pulse" />
                        ) : row.currentPrice != null ? `$${fmt(row.currentPrice)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-200 num hidden sm:table-cell">
                        {row.marketValue != null ? `$${fmt(row.marketValue)}` : '—'}
                      </td>
                      <td className={clsx('px-3 py-2.5 text-right font-semibold num', pnlPos ? 'text-green-400' : 'text-red-400')}>
                        {row.pnl != null ? fmtCurrency(row.pnl) : '—'}
                      </td>
                      <td className={clsx('px-3 py-2.5 text-right font-semibold num', pnlPos ? 'text-green-400' : 'text-red-400')}>
                        {row.pnlPct != null ? `${row.pnlPct >= 0 ? '+' : ''}${fmt(row.pnlPct)}%` : '—'}
                      </td>
                      {!usingLive && (
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => removeManualPosition(row.id)}
                            className="text-text-muted/40 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showAdd && (
        <AddPositionModal onClose={() => setShowAdd(false)} onAdded={handleAddPosition} />
      )}
    </div>
  );
}
