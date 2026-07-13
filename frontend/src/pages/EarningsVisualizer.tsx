import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ImageIcon } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import {
  fetchIncomeStatementFMP,
  fetchCashFlowStatementFMP,
  getFmpKey,
} from '../services/fmpService';
import { IncomeFlowDiagram } from '../components/earnings-visualizer/IncomeFlowDiagram';
import { CashFlowDiagram } from '../components/earnings-visualizer/CashFlowDiagram';
import { EarningsStatCards } from '../components/earnings-visualizer/StatCards';

function getWatermark(): string {
  return localStorage.getItem('tradeedge_watermark') || 'TradeEdge';
}

async function exportSvg(el: SVGSVGElement | null, filename: string) {
  if (!el) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(el);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function exportPng(el: SVGSVGElement | null, filename: string, w = 1920, h = 1100) {
  if (!el) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(el);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0f0e8';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename; a.click();
    }, 'image/png');
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export function EarningsVisualizer() {
  const storeSymbol = useWatchlistStore((s) => s.selectedSymbol);
  const [input, setInput] = useState(storeSymbol ?? 'NVDA');
  const [symbol, setSymbol] = useState(storeSymbol ?? 'NVDA');
  const [period, setPeriod] = useState<'quarter' | 'annual'>('quarter');
  const hasFmpKey = !!getFmpKey();
  const watermark = getWatermark();

  const incomeRef = useRef<SVGSVGElement>(null);
  const cashRef   = useRef<SVGSVGElement>(null);

  const { data: incomeData = [], isLoading: incomeLoading } = useQuery({
    queryKey: ['ev-income', symbol, period],
    queryFn: () => fetchIncomeStatementFMP(symbol, period, 2),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60_000,
  });

  const { data: cashData = [], isLoading: cashLoading } = useQuery({
    queryKey: ['ev-cashflow', symbol, period],
    queryFn: () => fetchCashFlowStatementFMP(symbol, period, 2),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60_000,
  });

  const isLoading = incomeLoading || cashLoading;
  const income = incomeData[0] ?? null;
  const incomePrev = incomeData[1] ?? null;
  const cash   = cashData[0] ?? null;
  const cashPrev = cashData[1] ?? null;

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setSymbol(input.trim().toUpperCase());
  }

  const safeFilename = useCallback((suffix: string) =>
    `${symbol}-${period === 'quarter' ? 'Q' : 'A'}-${suffix}`, [symbol, period]);

  return (
    <div className="p-4 min-h-full bg-bg-primary space-y-4">
      <div>
        <h1 className="text-base font-bold text-white">Earnings Visualizer</h1>
        <p className="text-xs text-text-muted">Publication-quality income &amp; cash flow diagrams</p>
      </div>

      <form onSubmit={handleGenerate} className="flex gap-2 items-center flex-wrap">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Ticker (e.g. NVDA)"
          className="flex-1 min-w-[140px] bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
        />
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'quarter' | 'annual')}
          className="bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="quarter">Latest Quarter</option>
          <option value="annual">Latest Annual</option>
        </select>
        <button
          type="submit"
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors"
        >
          Generate
        </button>
      </form>

      {!hasFmpKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-sm text-amber-300">
          FMP API key required — add it in Settings
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <div className="h-72 bg-bg-card rounded-xl animate-pulse" />
          <div className="h-20 bg-bg-card rounded-xl animate-pulse" />
          <div className="h-64 bg-bg-card rounded-xl animate-pulse" />
        </div>
      )}

      {!isLoading && income && (
        <>
          <div className="rounded-xl overflow-hidden">
            <IncomeFlowDiagram ref={incomeRef} data={income} prev={incomePrev} watermark={watermark} />
          </div>

          <EarningsStatCards
            current={{ revenue: income.revenue, grossProfit: income.grossProfit, operatingIncome: income.operatingIncome, netIncome: income.netIncome, epsDiluted: income.epsDiluted }}
            previous={incomePrev ? { revenue: incomePrev.revenue, grossProfit: incomePrev.grossProfit, operatingIncome: incomePrev.operatingIncome, netIncome: incomePrev.netIncome, epsDiluted: incomePrev.epsDiluted } : null}
          />

          <div className="flex gap-2">
            <button onClick={() => exportPng(incomeRef.current, safeFilename('income.png'))}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-lg text-sm text-white font-medium transition-colors">
              <ImageIcon className="w-4 h-4" /> Export PNG (1920×1100)
            </button>
            <button onClick={() => exportSvg(incomeRef.current, safeFilename('income.svg'))}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-lg text-sm text-white font-medium transition-colors">
              <Download className="w-4 h-4" /> Export SVG
            </button>
          </div>
        </>
      )}

      {!isLoading && cash && (
        <>
          <div className="rounded-xl overflow-hidden mt-2">
            <CashFlowDiagram ref={cashRef} data={cash} prev={cashPrev} watermark={watermark} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => exportPng(cashRef.current, safeFilename('cashflow.png'))}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-lg text-sm text-white font-medium transition-colors">
              <ImageIcon className="w-4 h-4" /> Export PNG (1920×1100)
            </button>
            <button onClick={() => exportSvg(cashRef.current, safeFilename('cashflow.svg'))}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-lg text-sm text-white font-medium transition-colors">
              <Download className="w-4 h-4" /> Export SVG
            </button>
          </div>
        </>
      )}
    </div>
  );
}
