import { useState } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, PlusCircle, Download } from 'lucide-react';
import { fetchBatchQuotes } from '../services/api';
import { fetchAnalystEstimatesFMP, getFmpKey } from '../services/fmpService';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null): string {
  if (n == null || isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function fmtPE(n: number | null): string {
  if (n == null || isNaN(n) || !isFinite(n) || n < 0) return '—';
  return n.toFixed(1) + 'x';
}

function fmtGrowth(n: number | null): string {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function peColor(pe: number | null): string {
  if (pe == null) return 'text-text-muted';
  if (pe < 15) return 'text-green-400';
  if (pe < 25) return 'text-blue-300';
  if (pe < 40) return 'text-amber-300';
  return 'text-red-400';
}

// ─── Component ────────────────────────────────────────────────────────────────

type EpsField = 'cy' | 'ny' | 'fy';

export function EpsValuation() {
  const [tickerInput, setTickerInput] = useState('META,NVDA,AAPL');
  const [tickers, setTickers] = useState<string[]>(['META', 'NVDA', 'AAPL']);
  const [addTicker, setAddTicker] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  // EPS overrides: { TICKER: { cy?: '12.34', ny?: '14.00', fy?: '' } }
  const [epsOverrides, setEpsOverrides] = useState<Record<string, Partial<Record<EpsField, string>>>>({});
  const hasFmpKey = !!getFmpKey();
  const qc = useQueryClient();

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = tickerInput
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 8);
    if (!parsed.length) return;
    setTickers(parsed);
    setEpsOverrides({});
  }

  function handleAddTicker() {
    const t = addTicker.trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= 8) return;
    const next = [...tickers, t];
    setTickers(next);
    setTickerInput(next.join(','));
    setAddTicker('');
    setShowAdd(false);
  }

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ['eps-quotes'] });
  }

  function setOverride(ticker: string, field: EpsField, value: string) {
    setEpsOverrides((prev) => ({
      ...prev,
      [ticker]: { ...prev[ticker], [field]: value },
    }));
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  const quotesQuery = useQuery({
    queryKey: ['eps-quotes', tickers.join(',')],
    queryFn: () => fetchBatchQuotes(tickers),
    enabled: tickers.length > 0,
    staleTime: 60_000,
  });

  const estimateQueries = useQueries({
    queries: tickers.map((t) => ({
      queryKey: ['eps-est-annual', t],
      queryFn: () => fetchAnalystEstimatesFMP(t, 'annual'),
      enabled: hasFmpKey && !!t,
      staleTime: 30 * 60_000,
    })),
  });

  // ─── Build rows ─────────────────────────────────────────────────────────────

  function getYear(d: string) {
    return new Date(d + 'T12:00:00').getFullYear();
  }

  const rows = tickers.map((ticker, i) => {
    const quote = quotesQuery.data?.find((q) => q.symbol === ticker);
    const ests = estimateQueries[i]?.data ?? [];

    const cyEst = ests.find((e) => getYear(e.date) === CURRENT_YEAR);
    const nyEst = ests.find((e) => getYear(e.date) === CURRENT_YEAR + 1);
    const fyEst = ests.find((e) => getYear(e.date) === CURRENT_YEAR + 2);

    const over = epsOverrides[ticker] ?? {};

    // Base values from API
    const cyBase = cyEst?.estimatedEpsAvg ?? null;
    const nyBase = nyEst?.estimatedEpsAvg ?? null;
    const fyBase = fyEst?.estimatedEpsAvg ?? null;

    // Effective values (override takes precedence)
    const resolve = (field: EpsField, base: number | null): number | null => {
      const raw = over[field];
      if (raw === undefined) return base;
      const n = parseFloat(raw);
      return isNaN(n) ? null : n;
    };

    const cyEps = resolve('cy', cyBase);
    const nyEps = resolve('ny', nyBase);
    const fyEps = resolve('fy', fyBase);

    const price = quote?.price ?? null;
    const cyPE = price != null && cyEps != null && cyEps > 0 ? price / cyEps : null;
    const nyPE = price != null && nyEps != null && nyEps > 0 ? price / nyEps : null;
    const fyPE = price != null && fyEps != null && fyEps > 0 ? price / fyEps : null;
    const growth =
      cyEps != null && nyEps != null && cyEps !== 0
        ? ((nyEps - cyEps) / Math.abs(cyEps)) * 100
        : null;

    // Display values in inputs
    const cyDisplay = over.cy !== undefined ? over.cy : (cyBase?.toFixed(2) ?? '');
    const nyDisplay = over.ny !== undefined ? over.ny : (nyBase?.toFixed(2) ?? '');
    const fyDisplay = over.fy !== undefined ? over.fy : (fyBase?.toFixed(2) ?? '');

    return {
      ticker,
      company: quote?.shortName ?? ticker,
      price,
      cyPE, nyPE, fyPE,
      growth,
      cyDisplay, nyDisplay, fyDisplay,
      loading: estimateQueries[i]?.isLoading || quotesQuery.isLoading,
    };
  });

  // ─── Export CSV ─────────────────────────────────────────────────────────────

  function exportCSV() {
    const header = [
      'Company', 'Ticker', 'Price',
      `${CURRENT_YEAR} EPS`, `${CURRENT_YEAR + 1} EPS`, `${CURRENT_YEAR + 2} EPS`,
      `${CURRENT_YEAR} P/E`, `${CURRENT_YEAR + 1} P/E`, `${CURRENT_YEAR + 2} P/E`,
      'EPS Growth',
    ].join(',');
    const body = rows
      .map((r) =>
        [
          `"${r.company}"`,
          r.ticker,
          r.price?.toFixed(2) ?? '',
          r.cyDisplay,
          r.nyDisplay,
          r.fyDisplay,
          r.cyPE?.toFixed(1) ?? '',
          r.nyPE?.toFixed(1) ?? '',
          r.fyPE?.toFixed(1) ?? '',
          r.growth?.toFixed(1) ?? '',
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eps-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const anyLoading = quotesQuery.isLoading || estimateQueries.some((q) => q.isLoading);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 min-h-full bg-bg-primary space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-base font-bold text-white">EPS &amp; Valuation</h1>
        <p className="text-xs text-text-muted">
          Multi-ticker EPS table with live P/E recalculation — edit any EPS cell to update
        </p>
      </div>

      {/* Ticker input form */}
      <form onSubmit={handleGenerate} className="flex gap-2 items-center flex-wrap">
        <input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
          placeholder="META,NVDA,AAPL,MSFT (up to 8, comma-separated)"
          className="flex-1 min-w-[220px] bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button
          type="submit"
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors"
        >
          Generate
        </button>
      </form>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-sm text-amber-300">
          FMP API key required — add it in Settings to fetch EPS estimates
        </div>
      )}

      {/* Table */}
      {tickers.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-border-dim">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0d1030]">
                  <th className="sticky left-0 z-10 bg-[#0d1030] px-3 py-3 text-left text-text-muted font-semibold whitespace-nowrap border-b border-border-dim">
                    Company
                  </th>
                  <th className="px-3 py-3 text-left text-text-muted font-semibold border-b border-border-dim">
                    Ticker
                  </th>
                  <th className="px-3 py-3 text-right text-text-muted font-semibold border-b border-border-dim whitespace-nowrap">
                    Share Price
                  </th>
                  <th className="px-3 py-3 text-right text-amber-400/90 font-semibold border-b border-border-dim whitespace-nowrap">
                    {CURRENT_YEAR} EPS
                  </th>
                  <th className="px-3 py-3 text-right text-amber-400/90 font-semibold border-b border-border-dim whitespace-nowrap">
                    {CURRENT_YEAR + 1} EPS
                  </th>
                  <th className="px-3 py-3 text-right text-amber-400/90 font-semibold border-b border-border-dim whitespace-nowrap">
                    {CURRENT_YEAR + 2} EPS
                  </th>
                  <th className="px-3 py-3 text-right text-blue-400/90 font-semibold border-b border-border-dim whitespace-nowrap">
                    {CURRENT_YEAR} P/E
                  </th>
                  <th className="px-3 py-3 text-right text-blue-400/90 font-semibold border-b border-border-dim whitespace-nowrap">
                    {CURRENT_YEAR + 1} Fwd P/E
                  </th>
                  <th className="px-3 py-3 text-right text-blue-400/90 font-semibold border-b border-border-dim whitespace-nowrap">
                    {CURRENT_YEAR + 2} Fwd P/E
                  </th>
                  <th className="px-3 py-3 text-right text-text-muted font-semibold border-b border-border-dim whitespace-nowrap">
                    EPS Growth
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rowBg = i % 2 === 0 ? 'bg-bg-card' : 'bg-[#0a0d1f]';
                  return (
                    <tr key={row.ticker} className={rowBg}>
                      {/* Company (sticky) */}
                      <td className={`sticky left-0 z-10 ${rowBg} px-3 py-2.5 font-medium text-white whitespace-nowrap border-b border-border-dim/20`}>
                        {row.loading ? (
                          <div className="h-3 w-24 bg-border-dim/30 rounded animate-pulse" />
                        ) : (
                          <span className="text-[11px]">{row.company}</span>
                        )}
                      </td>
                      {/* Ticker */}
                      <td className="px-3 py-2.5 font-mono text-amber-400 border-b border-border-dim/20">
                        {row.ticker}
                      </td>
                      {/* Price */}
                      <td className="px-3 py-2.5 text-right font-mono text-white border-b border-border-dim/20">
                        {row.loading ? '…' : fmtPrice(row.price)}
                      </td>
                      {/* EPS inputs */}
                      {(['cy', 'ny', 'fy'] as const).map((field) => {
                        const display = field === 'cy' ? row.cyDisplay : field === 'ny' ? row.nyDisplay : row.fyDisplay;
                        return (
                          <td key={field} className="px-2 py-1.5 text-right border-b border-border-dim/20">
                            {row.loading ? (
                              <div className="h-6 w-14 bg-border-dim/30 rounded animate-pulse ml-auto" />
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                value={display}
                                onChange={(e) => setOverride(row.ticker, field, e.target.value)}
                                placeholder="—"
                                className="w-[68px] text-right bg-[#1a1e3a] border border-[#2a3470] hover:border-amber-500/50 focus:border-amber-500 rounded px-1.5 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* P/E cells */}
                      {[row.cyPE, row.nyPE, row.fyPE].map((pe, j) => (
                        <td key={j} className="px-3 py-2.5 text-right font-mono border-b border-border-dim/20">
                          {row.loading ? (
                            '…'
                          ) : (
                            <span className={`font-semibold ${peColor(pe)}`}>{fmtPE(pe)}</span>
                          )}
                        </td>
                      ))}
                      {/* EPS Growth */}
                      <td className="px-3 py-2.5 text-right font-mono border-b border-border-dim/20">
                        {row.loading ? (
                          '…'
                        ) : (
                          <span
                            className={
                              row.growth == null
                                ? 'text-text-muted'
                                : row.growth > 0
                                ? 'text-green-400 font-semibold'
                                : 'text-red-400 font-semibold'
                            }
                          >
                            {fmtGrowth(row.growth)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Hint row */}
          <div className="px-4 py-2 bg-[#0d1030] border-t border-border-dim/30 text-[10px] text-text-muted/60">
            ✎ EPS cells are editable — type to override analyst estimates and recalculate P/E instantly
          </div>
        </div>
      )}

      {/* Footer actions */}
      {tickers.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-card border border-border-dim rounded-lg text-xs text-white hover:border-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh Prices
          </button>

          {/* Add Ticker */}
          {showAdd ? (
            <div className="flex gap-1.5 items-center">
              <input
                autoFocus
                value={addTicker}
                onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTicker();
                  if (e.key === 'Escape') setShowAdd(false);
                }}
                placeholder="TICKER"
                maxLength={6}
                className="w-20 bg-bg-card border border-border-dim rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleAddTicker}
                disabled={tickers.length >= 8}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-lg text-xs font-semibold transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-2 py-1.5 text-text-muted hover:text-white text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              disabled={tickers.length >= 8}
              className="flex items-center gap-1.5 px-3 py-2 bg-bg-card border border-border-dim rounded-lg text-xs text-white hover:border-accent disabled:opacity-40 transition-colors"
            >
              <PlusCircle className="w-3 h-3" />
              + Add Ticker
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-card border border-border-dim rounded-lg text-xs text-white hover:border-accent transition-colors ml-auto"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      )}

      {anyLoading && (
        <p className="text-xs text-text-muted text-center animate-pulse">
          Fetching EPS estimates…
        </p>
      )}
    </div>
  );
}
