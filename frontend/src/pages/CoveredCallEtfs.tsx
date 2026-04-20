import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchBatchQuotes } from '../services/api';
import clsx from 'clsx';

interface CCEtf {
  symbol: string;
  name: string;
  underlying: string;
  frequency: string;
  approxYield: string;
}

const CC_ETFS: CCEtf[] = [
  { symbol: 'QYLD', name: 'Global X Nasdaq 100 Covered Call', underlying: 'QQQ (NASDAQ)', frequency: 'Monthly', approxYield: '~11%' },
  { symbol: 'XYLD', name: 'Global X S&P 500 Covered Call', underlying: 'SPX (S&P 500)', frequency: 'Monthly', approxYield: '~9%' },
  { symbol: 'RYLD', name: 'Global X Russell 2000 Covered Call', underlying: 'RUT (Russell 2000)', frequency: 'Monthly', approxYield: '~12%' },
  { symbol: 'JEPI', name: 'JPMorgan Equity Premium Income', underlying: 'S&P 500 (ELN)', frequency: 'Monthly', approxYield: '~8%' },
  { symbol: 'JEPQ', name: 'JPMorgan Nasdaq Equity Premium Income', underlying: 'NASDAQ (ELN)', frequency: 'Monthly', approxYield: '~10%' },
  { symbol: 'DIVO', name: 'Amplify CWP Enhanced Dividend Income', underlying: 'Dividend stocks', frequency: 'Monthly', approxYield: '~5%' },
  { symbol: 'QQQY', name: 'Defiance Nasdaq 100 Enhanced Options', underlying: 'QQQ', frequency: 'Weekly', approxYield: '~60%*' },
  { symbol: 'SPYI', name: 'NEOS S&P 500 High Income', underlying: 'SPX (tax-efficient)', frequency: 'Monthly', approxYield: '~12%' },
  { symbol: 'QQQI', name: 'NEOS Nasdaq 100 High Income', underlying: 'NDX (tax-efficient)', frequency: 'Monthly', approxYield: '~14%' },
  { symbol: 'XDTE', name: 'Roundhill S&P 500 0DTE Covered Call', underlying: 'SPX (0DTE)', frequency: 'Weekly', approxYield: '~50%*' },
];

const SYMBOLS = CC_ETFS.map((e) => e.symbol);

export function CoveredCallEtfs() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['cc-etf-quotes'],
    queryFn: () => fetchBatchQuotes(SYMBOLS),
    staleTime: 60_000,
  });

  function handleRow(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-teal-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Covered Call ETFs</h1>
      </div>
      <p className="text-[11px] text-text-muted mb-4">
        High-income ETFs using covered call strategies. Tap a row to view the chart.
      </p>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 mb-1">
        <span className="text-[10px] text-text-muted">Fund</span>
        <span className="text-[10px] text-text-muted text-right">Price</span>
        <span className="text-[10px] text-text-muted text-right">Change</span>
      </div>

      <div className="space-y-2">
        {CC_ETFS.map((etf) => {
          const q = quotes?.find((q) => q.symbol === etf.symbol);
          const pctColor = q && q.changePercent >= 0 ? 'text-green' : 'text-red-400';

          return (
            <button
              key={etf.symbol}
              onClick={() => handleRow(etf.symbol)}
              className="w-full bg-bg-card hover:bg-bg-hover border border-border-dim rounded-lg p-3 text-left transition-colors"
            >
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white font-mono">{etf.symbol}</span>
                    <span className="text-[9px] text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded">{etf.approxYield}</span>
                    <span className="text-[9px] text-text-muted">{etf.frequency}</span>
                  </div>
                  <p className="text-[10px] text-text-muted leading-snug truncate">{etf.name}</p>
                  <p className="text-[9px] text-text-muted/60 mt-0.5">{etf.underlying}</p>
                </div>
                {isLoading ? (
                  <>
                    <div className="w-12 h-4 bg-bg-hover rounded animate-pulse" />
                    <div className="w-12 h-4 bg-bg-hover rounded animate-pulse" />
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono text-white text-right">
                      {q ? `$${q.price.toFixed(2)}` : '—'}
                    </span>
                    <span className={clsx('text-xs font-mono text-right', pctColor)}>
                      {q ? `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%` : '—'}
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-text-muted/40 text-center mt-4">
        * Annualized yields are approximate and vary. Not financial advice.
      </p>
    </div>
  );
}
