import { useState } from 'react';
import clsx from 'clsx';
import { ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';
import { useAnalystRatings } from '../../hooks/useAnalystRatings';
import { useEarnings } from '../../hooks/useEarnings';
import { hasFinnhubKey } from '../../services/finnhubService';

interface AnalystPanelProps {
  symbol: string;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function AnalystPanel({ symbol }: AnalystPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'ratings' | 'earnings'>('ratings');
  const hasKey = hasFinnhubKey();

  const { data: ratings, isLoading: ratingsLoading } = useAnalystRatings(open ? symbol : null);
  const { data: earnings, isLoading: earningsLoading } = useEarnings(open ? symbol : null);

  // Aggregate latest ratings
  const latest = ratings?.[0];
  const totalRatings = latest
    ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
    : 0;

  const consensus = (() => {
    if (!latest || totalRatings === 0) return null;
    const score =
      (latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell * 1) / totalRatings;
    if (score >= 4.5) return { label: 'Strong Buy', color: 'text-green-400' };
    if (score >= 3.5) return { label: 'Buy', color: 'text-green-300' };
    if (score >= 2.5) return { label: 'Hold', color: 'text-yellow-400' };
    if (score >= 1.5) return { label: 'Sell', color: 'text-red-300' };
    return { label: 'Strong Sell', color: 'text-red-400' };
  })();

  // Upcoming earnings
  const today = new Date().toISOString().slice(0, 10);
  const nextEarnings = earnings?.find((e) => e.date >= today);
  const lastEarnings = earnings?.filter((e) => e.date < today).at(-1);

  return (
    <div className="border-t border-panel bg-bg-secondary shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 h-7 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-accent" /> Analyst · Earnings
          </span>
          {consensus && (
            <span className={clsx('text-[10px] font-semibold', consensus.color)}>
              {consensus.label} <span className="text-text-muted font-normal">({totalRatings})</span>
            </span>
          )}
          {nextEarnings && (
            <span className="text-[10px] text-yellow-400">
              Next earnings: {new Date(nextEarnings.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {!hasKey && <span className="text-[10px] text-text-muted">add Finnhub key in Settings</span>}
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronUp className="w-3.5 h-3.5 text-text-muted" />}
      </button>

      {open && (
        <div className="max-h-64 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-panel shrink-0">
            {(['ratings', 'earnings'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'px-4 py-1.5 text-[10px] font-medium capitalize transition-colors',
                  tab === t ? 'text-accent border-b border-accent' : 'text-text-muted hover:text-gray-300'
                )}
              >
                {t === 'ratings' ? 'Analyst Ratings' : 'Earnings History'}
              </button>
            ))}
          </div>

          <div className="overflow-auto flex-1">
            {/* ── Ratings tab ── */}
            {tab === 'ratings' && (
              <>
                {!hasKey && (
                  <div className="flex items-center justify-center h-20 text-[11px] text-text-muted">
                    Add your Finnhub API key in Settings → free at finnhub.io
                  </div>
                )}
                {hasKey && ratingsLoading && (
                  <div className="flex items-center justify-center h-20">
                    <div className="w-4 h-4 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
                  </div>
                )}
                {hasKey && !ratingsLoading && ratings && ratings.length > 0 && (
                  <div className="p-3 space-y-3">
                    {/* Consensus bar */}
                    {latest && totalRatings > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-text-muted mb-1">
                          <span>Strong Sell</span>
                          <span className={clsx('font-semibold', consensus?.color)}>{consensus?.label}</span>
                          <span>Strong Buy</span>
                        </div>
                        <div className="flex rounded overflow-hidden h-3">
                          {[
                            { count: latest.strongSell, color: 'bg-red-600' },
                            { count: latest.sell, color: 'bg-red-400' },
                            { count: latest.hold, color: 'bg-yellow-400' },
                            { count: latest.buy, color: 'bg-green-400' },
                            { count: latest.strongBuy, color: 'bg-green-600' },
                          ].map(({ count, color }, i) => (
                            count > 0 && (
                              <div
                                key={i}
                                className={color}
                                style={{ width: `${(count / totalRatings) * 100}%` }}
                                title={`${count}`}
                              />
                            )
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-text-muted mt-1">
                          <span>{latest.strongSell + latest.sell} Sell</span>
                          <span>{latest.hold} Hold</span>
                          <span>{latest.buy + latest.strongBuy} Buy</span>
                        </div>
                      </div>
                    )}

                    {/* Monthly trend table */}
                    <table className="w-full text-[10px] font-mono">
                      <thead>
                        <tr className="text-text-muted">
                          <th className="text-left pb-1">Period</th>
                          <th className="text-center pb-1 text-green-500">SB</th>
                          <th className="text-center pb-1 text-green-400">B</th>
                          <th className="text-center pb-1 text-yellow-400">H</th>
                          <th className="text-center pb-1 text-red-400">S</th>
                          <th className="text-center pb-1 text-red-500">SS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratings.map((r) => (
                          <tr key={r.period} className="border-t border-panel/50">
                            <td className="py-0.5 text-text-muted">
                              {new Date(r.period + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                            </td>
                            <td className="text-center text-green-500">{r.strongBuy}</td>
                            <td className="text-center text-green-400">{r.buy}</td>
                            <td className="text-center text-yellow-400">{r.hold}</td>
                            <td className="text-center text-red-400">{r.sell}</td>
                            <td className="text-center text-red-500">{r.strongSell}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── Earnings tab ── */}
            {tab === 'earnings' && (
              <>
                {!hasKey && (
                  <div className="flex items-center justify-center h-20 text-[11px] text-text-muted">
                    Add your Finnhub API key in Settings → free at finnhub.io
                  </div>
                )}
                {hasKey && earningsLoading && (
                  <div className="flex items-center justify-center h-20">
                    <div className="w-4 h-4 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
                  </div>
                )}
                {hasKey && !earningsLoading && earnings && (
                  <table className="w-full min-w-[380px]">
                    <thead>
                      <tr className="border-b border-panel sticky top-0 bg-bg-secondary">
                        {['Date', 'EPS Est.', 'EPS Act.', 'Surprise', 'Rev Est.'].map((h) => (
                          <th key={h} className="px-2 py-1 text-left text-[9px] font-semibold text-text-muted uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...earnings].reverse().map((e) => {
                        const upcoming = e.date >= today;
                        const pos = e.surprise != null && e.surprise >= 0;
                        return (
                          <tr key={e.date} className={clsx('border-b border-panel text-[10px] font-mono', upcoming && 'bg-yellow-400/5')}>
                            <td className="px-2 py-1 text-gray-300">
                              {new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                              {upcoming && <span className="ml-1 text-[9px] text-yellow-400">upcoming</span>}
                            </td>
                            <td className="px-2 py-1 text-text-muted">{e.epsEstimate != null ? fmt(e.epsEstimate) : '—'}</td>
                            <td className="px-2 py-1 text-gray-300">{e.epsActual != null ? fmt(e.epsActual) : '—'}</td>
                            <td className={clsx('px-2 py-1', e.surprise != null ? (pos ? 'text-green-400' : 'text-red-400') : 'text-text-muted')}>
                              {e.surprise != null ? `${pos ? '+' : ''}${fmt(e.surprise)}%` : '—'}
                            </td>
                            <td className="px-2 py-1 text-text-muted">
                              {e.revenueEstimate != null
                                ? e.revenueEstimate >= 1e9
                                  ? `$${(e.revenueEstimate / 1e9).toFixed(2)}B`
                                  : `$${(e.revenueEstimate / 1e6).toFixed(0)}M`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
