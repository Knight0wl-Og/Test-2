import { useState } from 'react';
import clsx from 'clsx';
import { ChevronUp, ChevronDown, Building2 } from 'lucide-react';
import { useInstitutional } from '../../hooks/useInstitutional';

interface InstitutionalPanelProps {
  symbol: string;
}

function fmtShares(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}

export function InstitutionalPanel({ symbol }: InstitutionalPanelProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useInstitutional(open ? symbol : null);

  const topHolder = data?.holders[0];

  return (
    <div className="border-t border-panel bg-bg-secondary shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 h-7 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-accent" /> Institutional Holdings
          </span>
          {data && (
            <>
              <span className="text-[10px] text-blue-300">
                Inst. {fmtPct(data.institutionPct)}
              </span>
              <span className="text-[10px] text-text-muted">
                Insider {fmtPct(data.insiderPct)}
              </span>
            </>
          )}
          {!data && !isLoading && !open && (
            <span className="text-[10px] text-text-muted">13F quarterly data · no key required</span>
          )}
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronUp className="w-3.5 h-3.5 text-text-muted" />}
      </button>

      {open && (
        <div className="max-h-64 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-20">
              <div className="w-4 h-4 border-2 border-border-dim border-t-accent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-20 text-[11px] text-text-muted">
              Failed to load institutional data
            </div>
          )}
          {data && !isLoading && (
            <>
              {/* Ownership breakdown bar */}
              <div className="px-3 py-2 border-b border-panel">
                <div className="flex rounded overflow-hidden h-3 mb-1">
                  <div className="bg-blue-500" style={{ width: `${Math.min(data.institutionPct, 100)}%` }} title={`Institutions ${fmtPct(data.institutionPct)}`} />
                  <div className="bg-purple-500" style={{ width: `${Math.min(data.insiderPct, 100)}%` }} title={`Insiders ${fmtPct(data.insiderPct)}`} />
                  <div className="bg-bg-hover flex-1" title="Public float" />
                </div>
                <div className="flex gap-4 text-[9px] text-text-muted">
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />Institutions {fmtPct(data.institutionPct)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-purple-500 mr-1" />Insiders {fmtPct(data.insiderPct)}</span>
                  <span><span className="inline-block w-2 h-2 rounded-sm bg-bg-hover border border-border-dim mr-1" />Public {fmtPct(Math.max(0, 100 - data.institutionPct - data.insiderPct))}</span>
                </div>
              </div>

              {/* Top holders table */}
              {data.holders.length > 0 ? (
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr className="border-b border-panel sticky top-0 bg-bg-secondary">
                      {['Institution', '% Held', 'Shares', 'Change', 'Reported'].map((h) => (
                        <th key={h} className="px-2 py-1 text-left text-[9px] font-semibold text-text-muted uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.holders.map((h, i) => {
                      const pos = (h.changeShares ?? 0) >= 0;
                      return (
                        <tr key={i} className="border-b border-panel text-[10px] font-mono hover:bg-bg-hover/30">
                          <td className="px-2 py-1 text-gray-300 max-w-[160px] truncate" title={h.name}>{h.name}</td>
                          <td className="px-2 py-1 text-blue-300">{fmtPct(h.pctHeld)}</td>
                          <td className="px-2 py-1 text-gray-400">{fmtShares(h.shares)}</td>
                          <td className={clsx('px-2 py-1', h.changeShares != null ? (pos ? 'text-green-400' : 'text-red-400') : 'text-text-muted')}>
                            {h.changeShares != null
                              ? `${pos ? '+' : ''}${fmtShares(h.changeShares)}`
                              : '—'}
                          </td>
                          <td className="px-2 py-1 text-text-muted">
                            {h.reportDate
                              ? new Date(h.reportDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-16 text-[11px] text-text-muted">
                  No institutional ownership data available
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
