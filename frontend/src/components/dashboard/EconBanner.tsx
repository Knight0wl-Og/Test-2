import { useQuery } from '@tanstack/react-query';
import { fetchEconomicCalendarFMP } from '../../services/fmpService';
import { getFmpKey } from '../../services/fmpService';
import { AlertCircle } from 'lucide-react';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function futureStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function EconBanner() {
  const hasFmp = !!getFmpKey();

  const { data: events = [] } = useQuery({
    queryKey: ['econ-banner'],
    queryFn: () => fetchEconomicCalendarFMP(todayStr(), futureStr(14)),
    enabled: hasFmp,
    staleTime: 60 * 60_000,
  });

  const next = events
    .filter((e) => e.impact === 'High' && e.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!hasFmp) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-bg-panel border-b border-border-dim/30 text-[11px]">
      <span className="text-amber-400 font-bold tracking-widest">ECON</span>
      <span className="text-border-dim/60">•</span>
      {next ? (
        <span className="text-gray-300">
          Next high-impact:{' '}
          <span className="text-white font-semibold">{next.event}</span>
          {' '}—{' '}
          <span className="text-amber-300">
            {new Date(next.date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </span>
          {next.consensus != null && (
            <span className="text-gray-500 ml-1">· Consensus: {next.consensus}{next.unit}</span>
          )}
        </span>
      ) : (
        <span className="text-gray-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> No high-impact economic events scheduled
        </span>
      )}
    </div>
  );
}
