import clsx from 'clsx';
import { useWatchlistStore } from '../../store/watchlistStore';

interface Creator {
  id: string;
  name: string;
  handle: string;
  style: string;
  styleColor: string;
  accent: string;
  philosophy: string;
  approach: string;
  tickers: string[];
}

const CREATORS: Creator[] = [
  {
    id: 'amit',
    name: 'Amit Kukreja',
    handle: '@amitcukreja',
    style: 'Growth · Tech',
    styleColor: '#f43f5e',
    accent: '#f43f5e',
    philosophy: 'Tracks institutional options flow and AI mega-cap momentum. Focuses on high-conviction tech positions backed by earnings growth and sector rotation.',
    approach: 'Opportunistic Buyer',
    tickers: ['NVDA', 'META', 'AAPL', 'TSLA', 'AMD', 'AMZN', 'GOOG'],
  },
  {
    id: 'steven',
    name: 'Steven Fiorillo',
    handle: '@stevenfiorillo',
    style: 'Dividend · Income',
    styleColor: '#06b6d4',
    accent: '#06b6d4',
    philosophy: 'Builds passive income through high-yield dividends, BDCs, and covered calls. Prioritizes cash flow generation and total return over pure capital appreciation.',
    approach: 'Income First',
    tickers: ['O', 'MAIN', 'JEPI', 'ABBV', 'BTI', 'MO', 'CVX', 'ENB'],
  },
  {
    id: 'minority',
    name: 'Minority Mindset',
    handle: '@minoritymindset',
    style: 'Index · Education',
    styleColor: '#10b981',
    accent: '#10b981',
    philosophy: 'Advocates for financial literacy and simple index fund investing. Emphasizes consistent DCA into broad-market ETFs regardless of market conditions.',
    approach: 'Always Invested',
    tickers: ['VOO', 'VTI', 'SCHD', 'VNQ', 'BRK-B'],
  },
  {
    id: 'profg',
    name: 'Prof G · Investing',
    handle: '@nolangouveia',
    style: 'Passive · ETF',
    styleColor: '#f97316',
    accent: '#f97316',
    philosophy: 'Keep it simple — low-cost ETFs and dividend growers held forever. Consistent contributions and reinvested dividends beat market timing over any long horizon.',
    approach: 'Buy & Hold Forever',
    tickers: ['VOO', 'SCHD', 'JEPI', 'VYM', 'O', 'VTI'],
  },
];

function TickerChip({
  symbol,
  accent,
}: {
  symbol: string;
  accent: string;
}) {
  const selectSymbol = useWatchlistStore((s) => s.selectSymbol);
  return (
    <button
      onClick={() => selectSymbol(symbol)}
      className="px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors bg-bg-hover hover:text-white text-text-muted border border-border-dim hover:border-opacity-60"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      {symbol}
    </button>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  const initials = creator.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return (
    <div className="card-surface p-4 flex flex-col gap-3 min-w-[260px] lg:min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: creator.accent + '33', border: `1.5px solid ${creator.accent}55` }}
        >
          <span style={{ color: creator.accent }}>{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{creator.name}</p>
          <p className="text-xs text-text-muted">{creator.handle}</p>
        </div>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ color: creator.accent, backgroundColor: creator.accent + '1a' }}
        >
          {creator.approach}
        </span>
      </div>

      {/* Style tag */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted uppercase tracking-widest">{creator.style}</span>
      </div>

      {/* Philosophy */}
      <p className="text-xs text-text-muted leading-relaxed">
        {creator.philosophy}
      </p>

      {/* Tickers */}
      <div className="flex flex-wrap gap-1.5">
        {creator.tickers.map((t) => (
          <TickerChip key={t} symbol={t} accent={creator.accent} />
        ))}
      </div>
    </div>
  );
}

export function CreatorInsights() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-text-muted uppercase tracking-widest">Creator Picks & Philosophy</span>
        <span className="text-xs text-text-muted/50">· tap any ticker to chart it</span>
      </div>
      <div className={clsx(
        'flex gap-3 overflow-x-auto pb-1',
        'lg:grid lg:grid-cols-4 lg:overflow-x-visible'
      )}>
        {CREATORS.map((c) => (
          <CreatorCard key={c.id} creator={c} />
        ))}
      </div>
      <p className="text-xs text-text-muted/40 mt-2">
        Philosophies based on publicly stated views. Not financial advice. Always do your own research.
      </p>
    </div>
  );
}
