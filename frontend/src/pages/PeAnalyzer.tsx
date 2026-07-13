import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompare, X } from 'lucide-react';
import { fetchFinancialRatiosFMP, getFmpKey } from '../services/fmpService';
import clsx from 'clsx';

const COLORS = ['text-accent', 'text-green', 'text-amber-400', 'text-rose-400'];
const BG_COLORS = ['bg-accent/20', 'bg-green/20', 'bg-amber-400/20', 'bg-rose-400/20'];

function SymbolResult({ symbol, color, onRemove }: { symbol: string; color: string; onRemove: () => void }) {
  const hasFmpKey = !!getFmpKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['fin-ratios', symbol],
    queryFn: () => fetchFinancialRatiosFMP(symbol),
    enabled: hasFmpKey && !!symbol,
    staleTime: 30 * 60 * 1000,
  });

  const latest = data?.[0];
  const older = data?.[3]; // ~1 year ago

  return (
    <div className="card-surface p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className={clsx('text-sm font-bold font-mono', color)}>{symbol}</span>
        <button onClick={onRemove} className="text-text-muted hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 bg-bg-hover rounded animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error instanceof Error ? error.message : 'Error'}</p>}

      {latest && (
        <div className="space-y-1.5">
          {[
            { label: 'P/E Ratio', val: latest.priceEarningsRatio, prev: older?.priceEarningsRatio, unit: 'x' },
            { label: 'P/B Ratio', val: latest.priceToBookRatio, prev: older?.priceToBookRatio, unit: 'x' },
            { label: 'P/S Ratio', val: latest.priceToSalesRatio, prev: older?.priceToSalesRatio, unit: 'x' },
            { label: 'Net Margin', val: latest.netProfitMargin != null ? latest.netProfitMargin * 100 : null, prev: older?.netProfitMargin != null ? older.netProfitMargin * 100 : null, unit: '%' },
            { label: 'ROE', val: latest.returnOnEquity != null ? latest.returnOnEquity * 100 : null, prev: older?.returnOnEquity != null ? older.returnOnEquity * 100 : null, unit: '%' },
          ].map(({ label, val, prev, unit }) => {
            const change = val != null && prev != null ? val - prev : null;
            return (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">{label}</span>
                <div className="flex items-center gap-2">
                  {change != null && (
                    <span className={clsx(
                      'text-[9px] font-mono',
                      unit === '%'
                        ? change >= 0 ? 'text-green' : 'text-red-400'
                        : change <= 0 ? 'text-green' : 'text-amber-400'
                    )}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}{unit}
                    </span>
                  )}
                  <span className={clsx('text-xs font-mono font-semibold', color)}>
                    {val != null ? val.toFixed(2) + unit : '—'}
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-text-muted/40 pt-1">As of {latest.date}</p>
        </div>
      )}
    </div>
  );
}

export function PeAnalyzer() {
  const [input, setInput] = useState('');
  const [symbols, setSymbols] = useState<string[]>(['AAPL', 'MSFT']);

  function addSymbol() {
    const sym = input.trim().toUpperCase();
    if (!sym || symbols.includes(sym) || symbols.length >= 4) return;
    setSymbols([...symbols, sym]);
    setInput('');
  }

  function removeSymbol(sym: string) {
    setSymbols(symbols.filter((s) => s !== sym));
  }

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="w-4 h-4 text-orange-400 shrink-0" />
        <h1 className="text-base font-bold text-white">P/E Analyzer</h1>
      </div>
      <p className="text-[11px] text-text-muted mb-4">Compare up to 4 stocks — P/E, P/B, margins, ROE vs 1 year ago.</p>

      {/* Add symbol */}
      <form onSubmit={(e) => { e.preventDefault(); addSymbol(); }} className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="Add symbol"
          disabled={symbols.length >= 4}
          className="flex-1 bg-bg-card border border-border-dim rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent font-mono disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!input.trim() || symbols.length >= 4}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Add
        </button>
      </form>

      {/* Active symbols chips */}
      {symbols.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {symbols.map((sym, i) => (
            <span key={sym} className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border', BG_COLORS[i], COLORS[i], 'border-current/30')}>
              {sym}
              <button onClick={() => removeSymbol(sym)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {symbols.map((sym, i) => (
        <SymbolResult
          key={sym}
          symbol={sym}
          color={COLORS[i] ?? 'text-white'}
          onRemove={() => removeSymbol(sym)}
        />
      ))}

      {symbols.length === 0 && (
        <p className="text-center text-text-muted text-sm py-8">Add symbols above to compare</p>
      )}
    </div>
  );
}
