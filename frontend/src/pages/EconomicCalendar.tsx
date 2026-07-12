import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchEconomicCalendarFMP, getFmpKey, FmpUpgradeRequiredError } from '../services/fmpService';
import { ErrorState } from '../components/common/ErrorState';
import { KeyRequiredCard } from '../components/common/KeyRequiredCard';
import clsx from 'clsx';

function getWeekBounds(offset = 0): { from: string; to: string; label: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const lbl = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' + sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { from: fmt(monday), to: fmt(sunday), label: lbl };
}

const IMPACT_COLOR: Record<string, string> = {
  High: 'text-red-400 bg-red-400/10',
  Medium: 'text-amber-400 bg-amber-400/10',
  Low: 'text-text-muted bg-bg-hover',
};

function fmtNum(n: number | null, unit: string): string {
  if (n == null) return '—';
  if (unit === '%') return n.toFixed(2) + '%';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toFixed(2);
}

export function EconomicCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to, label } = getWeekBounds(weekOffset);
  const hasFmpKey = !!getFmpKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['economic-calendar', from, to],
    queryFn: () => fetchEconomicCalendarFMP(from, to),
    enabled: hasFmpKey,
    staleTime: 30 * 60 * 1000,
  });

  // Group by date
  const byDate: Record<string, typeof data> = {};
  (data ?? []).forEach((e) => {
    const d = e.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d]!.push(e);
  });

  const dates = Object.keys(byDate).sort();

  return (
    <div className="p-4 min-h-full bg-bg-primary">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-rose-400 shrink-0" />
        <h1 className="text-sm font-bold text-white">Economic Calendar</h1>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 bg-bg-card border border-border-dim rounded-lg px-3 py-2">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="text-text-muted hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-gray-300">{label}</span>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="text-text-muted hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {!hasFmpKey && <KeyRequiredCard provider="fmp" feature="Economic Calendar" />}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-bg-card rounded animate-pulse" />
          ))}
        </div>
      )}

      {error != null && (
        error instanceof FmpUpgradeRequiredError ? (
          <KeyRequiredCard provider="fmp" reason="paid-plan" feature="Economic Calendar" />
        ) : (
          <ErrorState
            title="Failed to load economic calendar"
            message={error instanceof Error ? error.message : undefined}
          />
        )
      )}

      {dates.length === 0 && !isLoading && hasFmpKey && !error && (
        <p className="text-center text-text-muted text-sm py-8">No events scheduled this week</p>
      )}

      <div className="space-y-4">
        {dates.map((date) => {
          const events = byDate[date] ?? [];
          const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          });
          return (
            <div key={date}>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">{dayLabel}</p>
              <div className="space-y-1.5">
                {events
                  .sort((a, b) => {
                    const order = { High: 0, Medium: 1, Low: 2 };
                    return (order[a.impact] ?? 3) - (order[b.impact] ?? 3);
                  })
                  .map((ev, i) => (
                    <div
                      key={i}
                      className="bg-bg-card border border-border-dim rounded-lg px-3 py-2.5 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate leading-snug">{ev.event}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{ev.country}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-text-muted">Actual</p>
                        <p className={clsx(
                          'text-xs font-mono font-semibold',
                          ev.actual != null && ev.consensus != null
                            ? ev.actual >= ev.consensus ? 'text-green' : 'text-red-400'
                            : 'text-text-muted'
                        )}>
                          {fmtNum(ev.actual, ev.unit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-text-muted">Est.</p>
                        <p className="text-xs font-mono text-gray-400">{fmtNum(ev.consensus, ev.unit)}</p>
                      </div>
                      <span className={clsx('text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase', IMPACT_COLOR[ev.impact] ?? IMPACT_COLOR.Low)}>
                        {ev.impact}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
