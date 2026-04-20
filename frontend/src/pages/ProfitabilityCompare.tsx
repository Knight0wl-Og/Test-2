import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { BarChart, Download } from 'lucide-react';
import { fetchFinancialRatiosFMP, fetchKeyMetricsFMP, getFmpKey } from '../services/fmpService';
import clsx from 'clsx';

interface SymbolData {
  symbol: string;
  ratios: Awaited<ReturnType<typeof fetchFinancialRatiosFMP>>;
  metrics: Awaited<ReturnType<typeof fetchKeyMetricsFMP>>;
}

function fmt(v: number | null | undefined, decimals = 2, suffix = '') {
  if (v == null || isNaN(v as number)) return '—';
  return (v as number).toFixed(decimals) + suffix;
}
function fmtPct(v: number | null | undefined) {
  return fmt(v != null ? (v as number) * 100 : null, 1, '%');
}
function fmtLarge(v: number | null | undefined) {
  if (v == null) return '—';
  const n = v as number;
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${(n / 1e6).toFixed(1)}M`;
}

function MetricRow({ label, values }: { label: string; values: (string | null)[] }) {
  return (
    <tr className="border-b border-border-dim/20 hover:bg-bg-hover/30 transition-colors">
      <td className="py-2 pr-3 text-[11px] text-text-muted whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-2 text-xs font-mono text-right text-white">{v ?? '—'}</td>
      ))}
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={5} className="pt-4 pb-1 text-[10px] font-bold text-amber-400 uppercase tracking-widest">{label}</td>
    </tr>
  );
}

export function ProfitabilityCompare() {
  const [inputStr, setInputStr] = useState('NVDA,AMD');
  const [symbols, setSymbols] = useState<string[]>(['NVDA', 'AMD']);
  const hasFmpKey = !!getFmpKey();

  function handleGenerate() {
    const syms = inputStr
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 8);
    setSymbols(syms);
  }

  const ratioQueries = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['fin-ratios', sym],
      queryFn: () => fetchFinancialRatiosFMP(sym),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const metricQueries = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['key-metrics', sym],
      queryFn: () => fetchKeyMetricsFMP(sym),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const isLoading = ratioQueries.some((q) => q.isLoading) || metricQueries.some((q) => q.isLoading);

  const data: SymbolData[] = symbols.map((sym, i) => ({
    symbol: sym,
    ratios: ratioQueries[i]?.data ?? [],
    metrics: metricQueries[i]?.data ?? [],
  }));

  function exportCsv() {
    const rows: string[][] = [];
    const header = ['Metric', ...symbols];
    rows.push(header);
    const addRow = (label: string, vals: (string | null)[]) => rows.push([label, ...vals.map((v) => v ?? '')]);

    const r = (sym: string) => data.find((d) => d.symbol === sym)?.ratios[0];
    const m = (sym: string) => data.find((d) => d.symbol === sym)?.metrics[0];

    rows.push(['OVERVIEW']);
    addRow('P/E Ratio', symbols.map((s) => fmt(r(s)?.priceEarningsRatio, 2, 'x')));
    addRow('P/B Ratio', symbols.map((s) => fmt(r(s)?.priceToBookRatio, 2, 'x')));
    addRow('P/S Ratio', symbols.map((s) => fmt(r(s)?.priceToSalesRatio, 2, 'x')));
    addRow('Market Cap', symbols.map((s) => fmtLarge(m(s)?.marketCap)));
    rows.push(['PROFITABILITY']);
    addRow('Gross Margin', symbols.map((s) => fmtPct(r(s)?.grossProfitMargin)));
    addRow('Operating Margin', symbols.map((s) => fmtPct(r(s)?.operatingProfitMargin)));
    addRow('Net Margin', symbols.map((s) => fmtPct(r(s)?.netProfitMargin)));
    addRow('ROE', symbols.map((s) => fmtPct(r(s)?.returnOnEquity)));
    addRow('ROA', symbols.map((s) => fmtPct(r(s)?.returnOnAssets)));
    rows.push(['DEBT']);
    addRow('D/E Ratio', symbols.map((s) => fmt(r(s)?.debtEquityRatio, 2, 'x')));
    addRow('Current Ratio', symbols.map((s) => fmt(r(s)?.currentRatio, 2, 'x')));

    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profitability-compare-${symbols.join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-2">
        <BarChart className="w-4 h-4 text-emerald-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Profitability Compare</h1>
      </div>
      <p className="text-[11px] text-text-muted mb-4">Side-by-side analysis. Up to 8 tickers.</p>

      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value.toUpperCase())}
          placeholder="AAPL,MSFT,GOOGL"
          className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          Generate
        </button>
        {symbols.length > 0 && (
          <button
            onClick={exportCsv}
            className="px-3 py-2 bg-bg-card hover:bg-bg-hover border border-border-dim rounded-lg text-text-muted hover:text-white transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">FMP API Key Required</p>
          <p className="text-xs text-text-muted">Add your free FMP key in Settings</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {symbols.length > 0 && !isLoading && hasFmpKey && (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[320px]">
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left text-[10px] text-text-muted uppercase tracking-wider">Metric</th>
                {symbols.map((sym, i) => (
                  <th key={sym} className={clsx('py-2 px-2 text-right text-[11px] font-bold font-mono uppercase', i % 2 === 0 ? 'text-accent' : 'text-green')}>
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SectionHeader label="Overview" />
              <MetricRow label="P/E Ratio" values={symbols.map((s) => fmt(data.find((d) => d.symbol === s)?.ratios[0]?.priceEarningsRatio, 2, 'x'))} />
              <MetricRow label="P/B Ratio" values={symbols.map((s) => fmt(data.find((d) => d.symbol === s)?.ratios[0]?.priceToBookRatio, 2, 'x'))} />
              <MetricRow label="P/S Ratio" values={symbols.map((s) => fmt(data.find((d) => d.symbol === s)?.ratios[0]?.priceToSalesRatio, 2, 'x'))} />
              <MetricRow label="Market Cap" values={symbols.map((s) => fmtLarge(data.find((d) => d.symbol === s)?.metrics[0]?.marketCap))} />

              <SectionHeader label="Profitability" />
              <MetricRow label="Gross Margin" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.ratios[0]?.grossProfitMargin))} />
              <MetricRow label="Operating Margin" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.ratios[0]?.operatingProfitMargin))} />
              <MetricRow label="Net Margin" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.ratios[0]?.netProfitMargin))} />
              <MetricRow label="Return on Equity" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.ratios[0]?.returnOnEquity))} />
              <MetricRow label="Return on Assets" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.ratios[0]?.returnOnAssets))} />

              <SectionHeader label="Debt & Liquidity" />
              <MetricRow label="Debt / Equity" values={symbols.map((s) => fmt(data.find((d) => d.symbol === s)?.ratios[0]?.debtEquityRatio, 2, 'x'))} />
              <MetricRow label="Current Ratio" values={symbols.map((s) => fmt(data.find((d) => d.symbol === s)?.ratios[0]?.currentRatio, 2, 'x'))} />

              <SectionHeader label="Yield & Value" />
              <MetricRow label="Earnings Yield" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.metrics[0]?.earningsYield))} />
              <MetricRow label="Dividend Yield" values={symbols.map((s) => fmtPct(data.find((d) => d.symbol === s)?.metrics[0]?.dividendYield))} />
              <MetricRow label="EV/EBITDA" values={symbols.map((s) => fmt(data.find((d) => d.symbol === s)?.metrics[0]?.enterpriseValueOverEBITDA, 2, 'x'))} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
