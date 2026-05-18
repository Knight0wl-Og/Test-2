import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchEarningsCalendarRange, hasFinnhubKey } from '../services/finnhubService';
import clsx from 'clsx';

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekDays(offset = 0): { date: string; dayName: string; dayNum: number; isToday: boolean }[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const todayStr = now.toISOString().slice(0, 10);
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      dayName: DAY_NAMES[i],
      dayNum: d.getDate(),
      isToday: d.toISOString().slice(0, 10) === todayStr,
    };
  });
}

function getWeekLabel(offset: number): string {
  const days = getWeekDays(offset);
  const from = new Date(days[0].date);
  const to = new Date(days[4].date);
  return (
    from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' +
    to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );
}

// ─── Logo tile ────────────────────────────────────────────────────────────────

const LOGO_COLORS = [
  '#1e40af', '#065f46', '#7c2d12', '#581c87', '#134e4a',
  '#1e3a5f', '#3b0764', '#4a1942', '#14532d', '#7c3a00',
];

function symbolColor(sym: string): string {
  let n = 0;
  for (const c of sym) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return LOGO_COLORS[n % LOGO_COLORS.length];
}

function CompanyLogo({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
    >
      <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-white/10 group-hover:ring-accent/60 transition-all">
        {!imgError ? (
          <img
            src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
            alt={symbol}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: symbolColor(symbol) }}
          >
            {symbol[0]}
          </div>
        )}
      </div>
      <span className="text-[10px] font-semibold text-gray-300 group-hover:text-white transition-colors leading-none">
        {symbol}
      </span>
    </button>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

interface EarningsEvent {
  symbol: string;
  date: string;
  hour?: string;
  epsEstimate?: number | null;
  epsActual?: number | null;
}

function DayColumn({
  dayName,
  dayNum,
  isToday,
  bmo,
  amc,
  onSelect,
}: {
  dayName: string;
  dayNum: number;
  isToday: boolean;
  bmo: EarningsEvent[];
  amc: EarningsEvent[];
  onSelect: (symbol: string) => void;
}) {
  const hasAny = bmo.length > 0 || amc.length > 0;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Day header */}
      <div className="flex flex-col items-center gap-0.5 py-1">
        <span className={clsx('text-[11px] font-medium', isToday ? 'text-white' : 'text-gray-500')}>
          {dayName}
        </span>
        <div
          className={clsx(
            'w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold',
            isToday ? 'bg-green-500 text-white' : 'text-gray-400'
          )}
        >
          {dayNum}
        </div>
      </div>

      {!hasAny ? (
        <div className="flex-1 rounded-xl bg-[#0d0e1a] border border-white/5 flex items-center justify-center min-h-[80px]">
          <span className="text-[10px] text-gray-700">—</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bmo.length > 0 && (
            <div className="rounded-xl bg-[#0d0e1a] border border-white/5 p-2">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[9px] text-yellow-400 font-semibold tracking-wide">☀ Before Open</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {bmo.map((e) => (
                  <CompanyLogo key={e.symbol} symbol={e.symbol} onClick={() => onSelect(e.symbol)} />
                ))}
              </div>
            </div>
          )}

          {amc.length > 0 && (
            <div className="rounded-xl bg-[#0d0e1a] border border-white/5 p-2">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[9px] text-blue-400 font-semibold tracking-wide">🌙 After Close</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {amc.map((e) => (
                  <CompanyLogo key={e.symbol} symbol={e.symbol} onClick={() => onSelect(e.symbol)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Earnings() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const [weekOffset, setWeekOffset] = useState(0);
  const hasKey = hasFinnhubKey();

  const days = getWeekDays(weekOffset);
  const from = days[0].date;
  const to = days[4].date;

  const { data, isLoading, error } = useQuery({
    queryKey: ['earnings-calendar-fh', from, to],
    queryFn: () => fetchEarningsCalendarRange(from, to),
    enabled: hasKey,
    staleTime: 30 * 60 * 1000,
  });

  function handleSelect(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  // Group events by date and timing
  const grouped: Record<string, { bmo: EarningsEvent[]; amc: EarningsEvent[] }> = {};
  for (const d of days) {
    grouped[d.date] = { bmo: [], amc: [] };
  }
  if (data) {
    for (const e of data) {
      if (!grouped[e.date]) continue;
      if (e.hour === 'bmo') grouped[e.date].bmo.push(e);
      else grouped[e.date].amc.push(e); // amc, dmh, or unknown → after close bucket
    }
  }

  const totalCompanies = data?.length ?? 0;

  return (
    <div className="p-4 min-h-full bg-bg-primary flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent shrink-0" />
        <h1 className="text-sm font-bold text-white">Earnings Calendar</h1>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-bg-card border border-border-dim rounded-lg px-3 py-2">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="text-text-muted hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-gray-300">{getWeekLabel(weekOffset)}</span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="text-text-muted hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* No key */}
      {!hasKey && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-300 mb-1">Finnhub API Key Required</p>
          <p className="text-xs text-text-muted">Add your free Finnhub key in Settings — get one at finnhub.io</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-48 bg-bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Failed to load earnings'}
        </div>
      )}

      {/* Calendar grid */}
      {!isLoading && !error && hasKey && (
        <>
          <div className="grid grid-cols-5 gap-2">
            {days.map((d) => (
              <DayColumn
                key={d.date}
                dayName={d.dayName}
                dayNum={d.dayNum}
                isToday={d.isToday}
                bmo={grouped[d.date]?.bmo ?? []}
                amc={grouped[d.date]?.amc ?? []}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {totalCompanies > 0 && (
            <p className="text-[10px] text-text-muted/50 text-center">
              {totalCompanies} companies reporting · tap a logo to view chart
            </p>
          )}

          {totalCompanies === 0 && (
            <p className="text-center text-text-muted text-sm py-4">No earnings scheduled this week</p>
          )}
        </>
      )}
    </div>
  );
}
