import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { BarChart, Download } from 'lucide-react';
import {
  fetchFinancialRatiosFMP,
  fetchKeyMetricsFMP,
  fetchIncomeStatementFMP,
  fetchCashFlowStatementFMP,
  fetchAnalystEstimatesFMP,
  fetchPriceTargetConsensusFMP,
  getFmpKey,
  type FMPFinancialRatios,
  type FMPKeyMetrics,
  type FMPIncomeStatement,
  type FMPCashFlowStatement,
  type FMPAnalystEstimate,
  type FMPPriceTargetConsensus,
} from '../services/fmpService';
import clsx from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}
function fmtYoY(curr: number | null, prev: number | null): string {
  if (curr == null || prev == null || prev === 0) return '—';
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

/** Returns index of the winning value; -1 if fewer than 2 valid values */
function winnerIdx(vals: (number | null | undefined)[], higherIsBetter: boolean): number {
  const valid = vals.filter((v) => v != null && !isNaN(v as number));
  if (valid.length < 2) return -1;
  let best: number | null = null;
  let idx = -1;
  vals.forEach((v, i) => {
    if (v == null || isNaN(v as number)) return;
    const n = v as number;
    if (best == null || (higherIsBetter ? n > best : n < best)) {
      best = n;
      idx = i;
    }
  });
  return idx;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricRow({
  label,
  values,
  highlightIdx,
}: {
  label: string;
  values: (string | null)[];
  highlightIdx?: number;
}) {
  return (
    <tr className="border-b border-border-dim/20 hover:bg-bg-hover/30 transition-colors">
      <td className="py-2 pr-3 text-[11px] text-text-muted whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={clsx(
            'py-2 px-2 text-xs font-mono text-right',
            i === highlightIdx ? 'text-green-400 font-bold' : 'text-white'
          )}
        >
          {v ?? '—'}
        </td>
      ))}
    </tr>
  );
}

function SectionHeader({ label, colCount }: { label: string; colCount: number }) {
  return (
    <tr>
      <td
        colSpan={colCount + 1}
        className="pt-4 pb-1 text-[10px] font-bold text-amber-400 uppercase tracking-widest"
      >
        {label}
      </td>
    </tr>
  );
}

function VerdictBar({
  ticker,
  wins,
  total,
  categories,
  isChamp,
  symIdx,
}: {
  ticker: string;
  wins: number;
  total: number;
  categories: string[];
  isChamp: boolean;
  symIdx: number;
}) {
  const COLORS = [
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-pink-500',
  ];
  const barColor = isChamp ? 'bg-green-500' : COLORS[symIdx % COLORS.length];
  const pct = total > 0 ? (wins / total) * 100 : 0;

  return (
    <div className="flex-1 min-w-[100px]">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={clsx(
            'text-xs font-bold font-mono',
            isChamp ? 'text-green-400' : 'text-white'
          )}
        >
          {ticker}
          {isChamp && <span className="ml-1 text-amber-400">★</span>}
        </span>
        <span className="text-[11px] text-text-muted">
          {wins}
          <span className="text-text-muted/50">/{total}</span>
        </span>
      </div>
      <div className="h-3 bg-bg-card border border-border-dim/30 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {categories.map((cat) => (
          <span
            key={cat}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-700/30"
          >
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── VERDICT scoring ──────────────────────────────────────────────────────────

interface TickerAllData {
  r: FMPFinancialRatios | null;
  m: FMPKeyMetrics | null;
  incQ: FMPIncomeStatement | null;
  incQPrev: FMPIncomeStatement | null;
  cf: FMPCashFlowStatement | null;
  est: FMPAnalystEstimate[];
  pt: FMPPriceTargetConsensus | null;
  price: number | null; // derived from P/E * EPS or null
}

function computeVerdicts(symbols: string[], allData: TickerAllData[]) {
  const n = symbols.length;
  const wins = Array(n).fill(0);
  const catWins: string[][] = Array.from({ length: n }, () => []);
  let totalScorable = 0;

  function score(vals: (number | null | undefined)[], higherIsBetter: boolean, cat: string) {
    const valid = vals.filter((v) => v != null && !isNaN(v as number));
    if (valid.length < 2) return;
    totalScorable++;
    const idx = winnerIdx(vals, higherIsBetter);
    if (idx >= 0) {
      wins[idx]++;
      if (!catWins[idx].includes(cat)) catWins[idx].push(cat);
    }
  }

  // Valuation (5)
  score(allData.map((d) => d.r?.priceEarningsRatio), false, 'Valuation');
  score(allData.map((d) => d.r?.priceToBookRatio), false, 'Valuation');
  score(allData.map((d) => d.r?.priceToSalesRatio), false, 'Valuation');
  score(allData.map((d) => d.m?.enterpriseValueOverEBITDA), false, 'Valuation');
  score(allData.map((d) => d.m?.earningsYield), true, 'Valuation');

  // Profitability (5)
  score(allData.map((d) => d.r?.returnOnEquity), true, 'Profitability');
  score(allData.map((d) => d.r?.returnOnAssets), true, 'Profitability');
  score(allData.map((d) => d.m?.freeCashFlowYield), true, 'Profitability');
  score(allData.map((d) => d.m?.dividendYield), true, 'Profitability');
  score(allData.map((d) => d.m?.earningsYield), true, 'Profitability');

  // Margins (4)
  score(allData.map((d) => d.r?.grossProfitMargin), true, 'Margins');
  score(allData.map((d) => d.r?.operatingProfitMargin), true, 'Margins');
  score(allData.map((d) => d.r?.netProfitMargin), true, 'Margins');
  score(
    allData.map((d) =>
      d.cf && d.cf.operatingCashFlow && d.incQ?.revenue
        ? d.cf.freeCashFlow / (d.incQ.revenue * 4)
        : null
    ),
    true,
    'Margins'
  );

  // Cash & Balance Sheet (4)
  score(allData.map((d) => d.r?.debtEquityRatio), false, 'Cash & Debt');
  score(allData.map((d) => d.r?.currentRatio), true, 'Cash & Debt');
  score(allData.map((d) => d.cf?.operatingCashFlow), true, 'Cash & Debt');
  score(allData.map((d) => d.cf?.freeCashFlow), true, 'Cash & Debt');

  // Latest Quarter (4)
  score(allData.map((d) => d.incQ?.revenue), true, 'Latest Q');
  score(allData.map((d) => d.incQ?.netIncome), true, 'Latest Q');
  score(allData.map((d) => d.incQ?.epsDiluted), true, 'Latest Q');
  score(
    allData.map((d) =>
      d.incQ && d.incQ.revenue > 0 ? d.incQ.operatingIncome / d.incQ.revenue : null
    ),
    true,
    'Latest Q'
  );

  // Growth (4)
  score(
    allData.map((d) =>
      d.incQ && d.incQPrev && d.incQPrev.revenue > 0
        ? (d.incQ.revenue - d.incQPrev.revenue) / d.incQPrev.revenue
        : null
    ),
    true,
    'Growth'
  );
  score(
    allData.map((d) =>
      d.incQ && d.incQPrev && d.incQPrev.netIncome !== 0
        ? (d.incQ.netIncome - d.incQPrev.netIncome) / Math.abs(d.incQPrev.netIncome)
        : null
    ),
    true,
    'Growth'
  );
  score(
    allData.map((d) => {
      const cy = d.est[0]?.estimatedEpsAvg;
      const ny = d.est[1]?.estimatedEpsAvg;
      return cy && ny && cy !== 0 ? (ny - cy) / Math.abs(cy) : null;
    }),
    true,
    'Growth'
  );
  score(allData.map((d) => d.est[0]?.estimatedRevenueAvg), true, 'Growth');

  // Analyst (3)
  score(allData.map((d) => d.est[0]?.numberAnalystsEstimatedEps), true, 'Analyst');
  score(allData.map((d) => d.est[0]?.estimatedEpsAvg), true, 'Analyst');
  score(
    allData.map((d) => {
      if (!d.pt?.targetConsensus || !d.price) return null;
      return (d.pt.targetConsensus - d.price) / d.price;
    }),
    true,
    'Analyst'
  );

  const champIdx = wins.indexOf(Math.max(...wins));

  return symbols.map((sym, i) => ({
    sym,
    wins: wins[i],
    total: totalScorable,
    categories: catWins[i],
    isChamp: i === champIdx && wins[i] > 0,
  }));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfitabilityCompare() {
  const [inputStr, setInputStr] = useState('NVDA,AMD');
  const [symbols, setSymbols] = useState<string[]>(['NVDA', 'AMD']);
  const hasFmpKey = !!getFmpKey();

  function handleGenerate() {
    const syms = inputStr
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 6);
    setSymbols(syms);
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  const ratioQ = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['fin-ratios', sym],
      queryFn: () => fetchFinancialRatiosFMP(sym),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const metricQ = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['key-metrics', sym],
      queryFn: () => fetchKeyMetricsFMP(sym),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const incomeQQ = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['income-q2', sym],
      queryFn: () => fetchIncomeStatementFMP(sym, 'quarter', 2),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const cashFlowQ = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['cashflow-a1', sym],
      queryFn: () => fetchCashFlowStatementFMP(sym, 'annual', 1),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const analystQ = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['analyst-est-a3', sym],
      queryFn: () => fetchAnalystEstimatesFMP(sym, 'annual'),
      enabled: hasFmpKey,
      staleTime: 30 * 60 * 1000,
    })),
  });

  const priceTargetQ = useQueries({
    queries: symbols.map((sym) => ({
      queryKey: ['price-target', sym],
      queryFn: () => fetchPriceTargetConsensusFMP(sym),
      enabled: hasFmpKey,
      staleTime: 60 * 60 * 1000,
    })),
  });

  const isLoading =
    ratioQ.some((q) => q.isLoading) ||
    metricQ.some((q) => q.isLoading) ||
    incomeQQ.some((q) => q.isLoading);

  // ─── Build data arrays ───────────────────────────────────────────────────────

  const allData: TickerAllData[] = symbols.map((_, i) => {
    const r = ratioQ[i]?.data?.[0] ?? null;
    const m = metricQ[i]?.data?.[0] ?? null;
    const incomeArr = incomeQQ[i]?.data ?? [];
    const incQ = incomeArr[0] ?? null;
    const incQPrev = incomeArr[1] ?? null;
    const cf = cashFlowQ[i]?.data?.[0] ?? null;
    const est = analystQ[i]?.data ?? [];
    const pt = priceTargetQ[i]?.data ?? null;

    // Estimate current price from P/E × EPS if possible
    const price =
      r?.priceEarningsRatio && incQ?.epsDiluted
        ? r.priceEarningsRatio * incQ.epsDiluted
        : null;

    return { r, m, incQ, incQPrev, cf, est, pt, price };
  });

  const verdicts = !isLoading && symbols.length > 1
    ? computeVerdicts(symbols, allData)
    : null;

  // ─── Helpers for display ─────────────────────────────────────────────────────

  const colCount = symbols.length;

  function wIdx(rawVals: (number | null | undefined)[], higherIsBetter: boolean) {
    return winnerIdx(rawVals, higherIsBetter);
  }

  // ─── CSV export ──────────────────────────────────────────────────────────────

  function exportCsv() {
    const rows: string[][] = [['Metric', ...symbols]];
    const addRow = (label: string, vals: (string | null)[]) =>
      rows.push([label, ...vals.map((v) => v ?? '')]);

    rows.push(['OVERVIEW']);
    addRow('P/E Ratio', symbols.map((_, i) => fmt(allData[i].r?.priceEarningsRatio, 2, 'x')));
    addRow('P/B Ratio', symbols.map((_, i) => fmt(allData[i].r?.priceToBookRatio, 2, 'x')));
    addRow('P/S Ratio', symbols.map((_, i) => fmt(allData[i].r?.priceToSalesRatio, 2, 'x')));
    addRow('Market Cap', symbols.map((_, i) => fmtLarge(allData[i].m?.marketCap)));

    rows.push(['PROFITABILITY']);
    addRow('Gross Margin', symbols.map((_, i) => fmtPct(allData[i].r?.grossProfitMargin)));
    addRow('Operating Margin', symbols.map((_, i) => fmtPct(allData[i].r?.operatingProfitMargin)));
    addRow('Net Margin', symbols.map((_, i) => fmtPct(allData[i].r?.netProfitMargin)));
    addRow('ROE', symbols.map((_, i) => fmtPct(allData[i].r?.returnOnEquity)));
    addRow('ROA', symbols.map((_, i) => fmtPct(allData[i].r?.returnOnAssets)));

    rows.push(['DEBT & LIQUIDITY']);
    addRow('Debt/Equity', symbols.map((_, i) => fmt(allData[i].r?.debtEquityRatio, 2, 'x')));
    addRow('Current Ratio', symbols.map((_, i) => fmt(allData[i].r?.currentRatio, 2, 'x')));

    rows.push(['LATEST QUARTER']);
    addRow('Q Revenue', symbols.map((_, i) => fmtLarge(allData[i].incQ?.revenue)));
    addRow('Q Net Income', symbols.map((_, i) => fmtLarge(allData[i].incQ?.netIncome)));
    addRow('Q EPS (Diluted)', symbols.map((_, i) => fmt(allData[i].incQ?.epsDiluted, 2)));
    addRow('Q Op Margin', symbols.map((_, i) =>
      allData[i].incQ?.revenue
        ? fmtPct(allData[i].incQ!.operatingIncome / allData[i].incQ!.revenue)
        : '—'
    ));

    rows.push(['ANALYST CONSENSUS']);
    addRow('EPS Estimate (CY)', symbols.map((_, i) => fmt(allData[i].est[0]?.estimatedEpsAvg, 2)));
    addRow('Analyst Count', symbols.map((_, i) => String(allData[i].est[0]?.numberAnalystsEstimatedEps ?? '—')));
    addRow('Price Target', symbols.map((_, i) => allData[i].pt?.targetConsensus ? `$${allData[i].pt!.targetConsensus!.toFixed(2)}` : '—'));

    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `profitability-compare-${symbols.join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 min-h-full bg-bg-primary space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <h1 className="text-sm font-bold text-white">Profitability Compare</h1>
          <p className="text-[11px] text-text-muted">Side-by-side analysis · up to 6 tickers</p>
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value.toUpperCase())}
          placeholder="AAPL,MSFT,GOOGL"
          className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-sm font-semibold transition-colors"
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
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Comparison Table ── */}
      {symbols.length > 0 && !isLoading && hasFmpKey && (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[320px]">
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left text-[10px] text-text-muted uppercase tracking-wider">
                  Metric
                </th>
                {symbols.map((sym, i) => (
                  <th
                    key={sym}
                    className={clsx(
                      'py-2 px-2 text-right text-[11px] font-bold font-mono uppercase',
                      i % 2 === 0 ? 'text-accent' : 'text-green'
                    )}
                  >
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── OVERVIEW ── */}
              <SectionHeader label="Overview" colCount={colCount} />
              <MetricRow
                label="P/E Ratio"
                values={symbols.map((_, i) => fmt(allData[i].r?.priceEarningsRatio, 2, 'x'))}
                highlightIdx={wIdx(allData.map((d) => d.r?.priceEarningsRatio), false)}
              />
              <MetricRow
                label="P/B Ratio"
                values={symbols.map((_, i) => fmt(allData[i].r?.priceToBookRatio, 2, 'x'))}
                highlightIdx={wIdx(allData.map((d) => d.r?.priceToBookRatio), false)}
              />
              <MetricRow
                label="P/S Ratio"
                values={symbols.map((_, i) => fmt(allData[i].r?.priceToSalesRatio, 2, 'x'))}
                highlightIdx={wIdx(allData.map((d) => d.r?.priceToSalesRatio), false)}
              />
              <MetricRow
                label="Market Cap"
                values={symbols.map((_, i) => fmtLarge(allData[i].m?.marketCap))}
              />
              <MetricRow
                label="EV/EBITDA"
                values={symbols.map((_, i) => fmt(allData[i].m?.enterpriseValueOverEBITDA, 2, 'x'))}
                highlightIdx={wIdx(allData.map((d) => d.m?.enterpriseValueOverEBITDA), false)}
              />

              {/* ── PROFITABILITY ── */}
              <SectionHeader label="Profitability" colCount={colCount} />
              <MetricRow
                label="Gross Margin"
                values={symbols.map((_, i) => fmtPct(allData[i].r?.grossProfitMargin))}
                highlightIdx={wIdx(allData.map((d) => d.r?.grossProfitMargin), true)}
              />
              <MetricRow
                label="Operating Margin"
                values={symbols.map((_, i) => fmtPct(allData[i].r?.operatingProfitMargin))}
                highlightIdx={wIdx(allData.map((d) => d.r?.operatingProfitMargin), true)}
              />
              <MetricRow
                label="Net Margin"
                values={symbols.map((_, i) => fmtPct(allData[i].r?.netProfitMargin))}
                highlightIdx={wIdx(allData.map((d) => d.r?.netProfitMargin), true)}
              />
              <MetricRow
                label="Return on Equity"
                values={symbols.map((_, i) => fmtPct(allData[i].r?.returnOnEquity))}
                highlightIdx={wIdx(allData.map((d) => d.r?.returnOnEquity), true)}
              />
              <MetricRow
                label="Return on Assets"
                values={symbols.map((_, i) => fmtPct(allData[i].r?.returnOnAssets))}
                highlightIdx={wIdx(allData.map((d) => d.r?.returnOnAssets), true)}
              />

              {/* ── DEBT & LIQUIDITY ── */}
              <SectionHeader label="Debt &amp; Liquidity" colCount={colCount} />
              <MetricRow
                label="Debt / Equity"
                values={symbols.map((_, i) => fmt(allData[i].r?.debtEquityRatio, 2, 'x'))}
                highlightIdx={wIdx(allData.map((d) => d.r?.debtEquityRatio), false)}
              />
              <MetricRow
                label="Current Ratio"
                values={symbols.map((_, i) => fmt(allData[i].r?.currentRatio, 2, 'x'))}
                highlightIdx={wIdx(allData.map((d) => d.r?.currentRatio), true)}
              />

              {/* ── YIELD & VALUE ── */}
              <SectionHeader label="Yield &amp; Value" colCount={colCount} />
              <MetricRow
                label="Earnings Yield"
                values={symbols.map((_, i) => fmtPct(allData[i].m?.earningsYield))}
                highlightIdx={wIdx(allData.map((d) => d.m?.earningsYield), true)}
              />
              <MetricRow
                label="Dividend Yield"
                values={symbols.map((_, i) => fmtPct(allData[i].m?.dividendYield))}
                highlightIdx={wIdx(allData.map((d) => d.m?.dividendYield), true)}
              />
              <MetricRow
                label="FCF Yield"
                values={symbols.map((_, i) => fmtPct(allData[i].m?.freeCashFlowYield))}
                highlightIdx={wIdx(allData.map((d) => d.m?.freeCashFlowYield), true)}
              />

              {/* ── LATEST QUARTER ── */}
              <SectionHeader label="Latest Quarter" colCount={colCount} />
              <MetricRow
                label="Revenue"
                values={symbols.map((_, i) => fmtLarge(allData[i].incQ?.revenue))}
                highlightIdx={wIdx(allData.map((d) => d.incQ?.revenue), true)}
              />
              <MetricRow
                label="Net Income"
                values={symbols.map((_, i) => fmtLarge(allData[i].incQ?.netIncome))}
                highlightIdx={wIdx(allData.map((d) => d.incQ?.netIncome), true)}
              />
              <MetricRow
                label="EPS (Diluted)"
                values={symbols.map((_, i) => fmt(allData[i].incQ?.epsDiluted, 2))}
                highlightIdx={wIdx(allData.map((d) => d.incQ?.epsDiluted), true)}
              />
              <MetricRow
                label="Operating Margin"
                values={symbols.map((_, i) =>
                  allData[i].incQ?.revenue
                    ? fmtPct(allData[i].incQ!.operatingIncome / allData[i].incQ!.revenue)
                    : '—'
                )}
                highlightIdx={wIdx(
                  allData.map((d) =>
                    d.incQ?.revenue ? d.incQ.operatingIncome / d.incQ.revenue : null
                  ),
                  true
                )}
              />
              <MetricRow
                label="Revenue YoY"
                values={symbols.map((_, i) =>
                  fmtYoY(allData[i].incQ?.revenue ?? null, allData[i].incQPrev?.revenue ?? null)
                )}
                highlightIdx={wIdx(
                  allData.map((d) =>
                    d.incQ && d.incQPrev && d.incQPrev.revenue > 0
                      ? (d.incQ.revenue - d.incQPrev.revenue) / d.incQPrev.revenue
                      : null
                  ),
                  true
                )}
              />

              {/* ── ANALYST CONSENSUS ── */}
              <SectionHeader label="Analyst Consensus" colCount={colCount} />
              <MetricRow
                label="EPS Est. (CY)"
                values={symbols.map((_, i) =>
                  allData[i].est[0]?.estimatedEpsAvg != null
                    ? `$${allData[i].est[0].estimatedEpsAvg.toFixed(2)}`
                    : '—'
                )}
                highlightIdx={wIdx(allData.map((d) => d.est[0]?.estimatedEpsAvg), true)}
              />
              <MetricRow
                label="EPS Est. (NY)"
                values={symbols.map((_, i) =>
                  allData[i].est[1]?.estimatedEpsAvg != null
                    ? `$${allData[i].est[1].estimatedEpsAvg.toFixed(2)}`
                    : '—'
                )}
                highlightIdx={wIdx(allData.map((d) => d.est[1]?.estimatedEpsAvg), true)}
              />
              <MetricRow
                label="FWD EPS Growth"
                values={symbols.map((_, i) => {
                  const cy = allData[i].est[0]?.estimatedEpsAvg;
                  const ny = allData[i].est[1]?.estimatedEpsAvg;
                  return cy && ny && cy !== 0
                    ? (((ny - cy) / Math.abs(cy)) * 100).toFixed(1) + '%'
                    : '—';
                })}
                highlightIdx={wIdx(
                  allData.map((d) => {
                    const cy = d.est[0]?.estimatedEpsAvg;
                    const ny = d.est[1]?.estimatedEpsAvg;
                    return cy && ny && cy !== 0 ? (ny - cy) / Math.abs(cy) : null;
                  }),
                  true
                )}
              />
              <MetricRow
                label="Analyst Count"
                values={symbols.map((_, i) =>
                  String(allData[i].est[0]?.numberAnalystsEstimatedEps ?? '—')
                )}
                highlightIdx={wIdx(
                  allData.map((d) => d.est[0]?.numberAnalystsEstimatedEps),
                  true
                )}
              />
              <MetricRow
                label="Price Target"
                values={symbols.map((_, i) =>
                  allData[i].pt?.targetConsensus
                    ? `$${allData[i].pt!.targetConsensus!.toFixed(2)}`
                    : '—'
                )}
              />
            </tbody>
          </table>
        </div>
      )}

      {/* ── VERDICT ── */}
      {verdicts && verdicts.length > 1 && (
        <div className="rounded-xl border border-border-dim bg-[#0d1030] p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                VERDICT
              </h2>
              <p className="text-[10px] text-text-muted mt-0.5">
                Each metric awarded to the winner across all tickers
              </p>
            </div>
            {verdicts[0] && (
              <span className="text-[10px] text-text-muted/60">
                of {verdicts[0].total} metrics
              </span>
            )}
          </div>

          <div className="flex gap-4 flex-wrap">
            {verdicts.map((v, i) => (
              <VerdictBar
                key={v.sym}
                ticker={v.sym}
                wins={v.wins}
                total={v.total}
                categories={v.categories}
                isChamp={v.isChamp}
                symIdx={i}
              />
            ))}
          </div>

          {/* Category legend */}
          <div className="mt-4 pt-3 border-t border-border-dim/30 flex flex-wrap gap-x-4 gap-y-1">
            {['Valuation', 'Profitability', 'Margins', 'Cash & Debt', 'Latest Q', 'Growth', 'Analyst'].map(
              (cat) => (
                <span key={cat} className="text-[10px] text-text-muted">
                  <span className="text-amber-400/70">■</span> {cat}
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
