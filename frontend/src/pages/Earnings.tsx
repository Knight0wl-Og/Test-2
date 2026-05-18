import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, TrendingUp, LayoutGrid, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWatchlistStore } from '../store/watchlistStore';
import { fetchEarningsCalendarRange, hasFinnhubKey } from '../services/finnhubService';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningsEvent {
  symbol: string;
  date: string;
  hour?: string;
  epsEstimate?: number | null;
  epsActual?: number | null;
}

type ViewMode = 'grid' | 'list';

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekDays(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const todayStr = now.toISOString().slice(0, 10);
  const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
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

function getWeekLabel(offset: number) {
  const days = getWeekDays(offset);
  const from = new Date(days[0].date);
  const to = new Date(days[4].date);
  const mo = from.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const f = from.getDate();
  const t = to.getDate();
  return `${mo} ${f} – ${t}`;
}

// ─── Logo tile ────────────────────────────────────────────────────────────────

const LOGO_COLORS = [
  '#1e40af', '#065f46', '#7c2d12', '#581c87', '#134e4a',
  '#1e3a5f', '#3b0764', '#4a1942', '#14532d', '#7c3a00',
];

function symbolColor(sym: string) {
  let n = 0;
  for (const c of sym) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
  return LOGO_COLORS[n % LOGO_COLORS.length];
}

function CompanyLogo({
  symbol,
  size,
  onClick,
}: {
  symbol: string;
  size: 'sm' | 'lg';
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'lg' ? 'w-[72px] h-[72px]' : 'w-12 h-12';
  const text = size === 'lg' ? 'text-2xl' : 'text-lg';
  const label = size === 'lg' ? 'text-[11px]' : 'text-[10px]';

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <div
        className={clsx(
          dim,
          'rounded-2xl overflow-hidden flex items-center justify-center shrink-0',
          'ring-1 ring-white/10 group-hover:ring-accent/60 transition-all'
        )}
      >
        {!imgError ? (
          <img
            src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
            alt={symbol}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={clsx('w-full h-full flex items-center justify-center text-white font-bold', text)}
            style={{ backgroundColor: symbolColor(symbol) }}
          >
            {symbol[0]}
          </div>
        )}
      </div>
      <span className={clsx(label, 'font-semibold text-gray-300 group-hover:text-white transition-colors leading-none')}>
        {symbol}
      </span>
    </button>
  );
}

// ─── Shared section block (Before Open / After Close logos) ──────────────────

function SectionBlock({
  type,
  events,
  logoSize,
  onSelect,
}: {
  type: 'bmo' | 'amc';
  events: EarningsEvent[];
  logoSize: 'sm' | 'lg';
  onSelect: (s: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[#111222] border border-white/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <span className="text-base">{type === 'bmo' ? '☀️' : '🌙'}</span>
        <span className="text-sm font-semibold text-white">
          {type === 'bmo' ? 'Before Open' : 'After Close'}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 p-3">
        {events.map((e) => (
          <CompanyLogo
            key={e.symbol}
            symbol={e.symbol}
            size={logoSize}
            onClick={() => onSelect(e.symbol)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────

function ListView({
  days,
  grouped,
  onSelect,
}: {
  days: ReturnType<typeof getWeekDays>;
  grouped: Record<string, { bmo: EarningsEvent[]; amc: EarningsEvent[] }>;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {days.map((d) => {
        const { bmo, amc } = grouped[d.date] ?? { bmo: [], amc: [] };
        if (bmo.length === 0 && amc.length === 0) return null;
        return (
          <div key={d.date} className="flex gap-3">
            {/* Day pill */}
            <div className="flex flex-col items-center shrink-0 w-12 pt-1">
              <div
                className={clsx(
                  'w-12 rounded-2xl flex flex-col items-center justify-center py-2 gap-0.5',
                  d.isToday ? 'bg-green-500' : 'bg-[#1a1b2e]'
                )}
              >
                <span className={clsx('text-[10px] font-bold tracking-widest', d.isToday ? 'text-white' : 'text-gray-400')}>
                  {d.dayName}
                </span>
                <span className={clsx('text-xl font-bold leading-none', d.isToday ? 'text-white' : 'text-gray-200')}>
                  {d.dayNum}
                </span>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <SectionBlock type="bmo" events={bmo} logoSize="lg" onSelect={onSelect} />
              <SectionBlock type="amc" events={amc} logoSize="lg" onSelect={onSelect} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── GRID VIEW ────────────────────────────────────────────────────────────────

function GridView({
  days,
  grouped,
  onSelect,
}: {
  days: ReturnType<typeof getWeekDays>;
  grouped: Record<string, { bmo: EarningsEvent[]; amc: EarningsEvent[] }>;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {days.map((d) => {
        const { bmo, amc } = grouped[d.date] ?? { bmo: [], amc: [] };
        const hasAny = bmo.length > 0 || amc.length > 0;
        return (
          <div key={d.date} className="flex flex-col gap-1.5 min-w-0">
            {/* Day header */}
            <div className="flex flex-col items-center gap-0.5 py-1">
              <span className={clsx('text-[10px] font-bold tracking-widest', d.isToday ? 'text-white' : 'text-gray-500')}>
                {d.dayName}
              </span>
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold',
                  d.isToday ? 'bg-green-500 text-white' : 'text-gray-400'
                )}
              >
                {d.dayNum}
              </div>
            </div>

            {!hasAny ? (
              <div className="rounded-xl bg-[#0d0e1a] border border-white/5 flex items-center justify-center min-h-[60px]">
                <span className="text-[10px] text-gray-700">—</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {bmo.length > 0 && (
                  <div className="rounded-xl bg-[#0d0e1a] border border-white/5 p-1.5">
                    <p className="text-[8px] text-yellow-400 font-bold mb-1.5 tracking-wide">☀ BMO</p>
                    <div className="flex flex-wrap gap-1.5">
                      {bmo.map((e) => (
                        <CompanyLogo key={e.symbol} symbol={e.symbol} size="sm" onClick={() => onSelect(e.symbol)} />
                      ))}
                    </div>
                  </div>
                )}
                {amc.length > 0 && (
                  <div className="rounded-xl bg-[#0d0e1a] border border-white/5 p-1.5">
                    <p className="text-[8px] text-blue-400 font-bold mb-1.5 tracking-wide">🌙 AMC</p>
                    <div className="flex flex-wrap gap-1.5">
                      {amc.map((e) => (
                        <CompanyLogo key={e.symbol} symbol={e.symbol} size="sm" onClick={() => onSelect(e.symbol)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Earnings() {
  const navigate = useNavigate();
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('earnings_view') as ViewMode) ?? 'list'
  );
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

  function setView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('earnings_view', mode);
  }

  function handleSelect(symbol: string) {
    selectSymbol(symbol);
    navigate('/');
  }

  // Filter: only companies with analyst EPS estimates (removes micro-cap/OTC noise)
  const filtered = data?.filter((e) => e.epsEstimate != null) ?? [];

  // Group by date + timing
  const grouped: Record<string, { bmo: EarningsEvent[]; amc: EarningsEvent[] }> = {};
  for (const d of days) grouped[d.date] = { bmo: [], amc: [] };
  for (const e of filtered) {
    if (!grouped[e.date]) continue;
    if (e.hour === 'bmo') grouped[e.date].bmo.push(e);
    else grouped[e.date].amc.push(e);
  }

  return (
    <div className="p-4 min-h-full bg-bg-primary flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent shrink-0" />
          <h1 className="text-sm font-bold text-white">Earnings Calendar</h1>
        </div>
        {/* Layout toggle */}
        <div className="flex items-center gap-1 bg-bg-card border border-border-dim rounded-lg p-0.5">
          <button
            onClick={() => setView('list')}
            className={clsx(
              'p-1.5 rounded-md transition-colors',
              viewMode === 'list' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-gray-300'
            )}
            title="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={clsx(
              'p-1.5 rounded-md transition-colors',
              viewMode === 'grid' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-gray-300'
            )}
            title="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-bg-card border border-border-dim rounded-lg px-3 py-2">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="text-text-muted hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-gray-300 tracking-wide">{getWeekLabel(weekOffset)}</span>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="text-text-muted hover:text-white transition-colors">
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
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 bg-bg-card rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4 text-sm text-red-300">
          {error instanceof Error ? error.message : 'Failed to load earnings'}
        </div>
      )}

      {/* Calendar */}
      {!isLoading && !error && hasKey && (
        <>
          {viewMode === 'list' ? (
            <ListView days={days} grouped={grouped} onSelect={handleSelect} />
          ) : (
            <GridView days={days} grouped={grouped} onSelect={handleSelect} />
          )}

          {filtered.length === 0 && (
            <p className="text-center text-text-muted text-sm py-8">No notable earnings this week</p>
          )}

          {filtered.length > 0 && (
            <p className="text-[10px] text-text-muted/40 text-center mt-1">
              {filtered.length} companies · showing analyst-covered only · tap to view chart
            </p>
          )}
        </>
      )}
    </div>
  );
}
