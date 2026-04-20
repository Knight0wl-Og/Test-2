/**
 * Mobile "More" tab — Market Brief at top, then all features as a grid.
 */
import { useNavigate } from 'react-router-dom';
import {
  Search, BookOpen, LineChart, Bot, Bell, Briefcase,
  TrendingUp, Calendar, BarChart2, PieChart, BarChart,
  DollarSign, Layers, Activity, Newspaper, GitCompare,
  Zap, type LucideIcon,
} from 'lucide-react';
import { MarketBrief } from '../components/more/MarketBrief';

interface FeatureItem {
  icon: LucideIcon;
  label: string;
  description: string;
  path: string;
  color: string;
  comingSoon?: boolean;
}

const FEATURES: FeatureItem[] = [
  // ── New research suite (competitor parity) ───
  {
    icon: Newspaper,
    label: 'Intel Library',
    description: 'Market news & analysis',
    path: '/intel-library',
    color: 'text-sky-400 bg-sky-400/10',
  },
  {
    icon: Layers,
    label: 'Covered Call ETFs',
    description: 'QYLD, JEPI, JEPQ & more',
    path: '/covered-call-etfs',
    color: 'text-teal-400 bg-teal-400/10',
  },
  {
    icon: DollarSign,
    label: 'Dividends',
    description: 'History, yield & calendar',
    path: '/dividends',
    color: 'text-green bg-green/10',
  },
  {
    icon: Calendar,
    label: 'Earnings',
    description: 'Weekly earnings calendar',
    path: '/earnings',
    color: 'text-amber-400 bg-amber-400/10',
  },
  {
    icon: BarChart2,
    label: 'Earnings Predictor',
    description: 'EPS history & beat rate',
    path: '/earnings-predictor',
    color: 'text-purple bg-purple/10',
  },
  {
    icon: PieChart,
    label: 'Earnings Visualizer',
    description: 'Revenue & EPS charts',
    path: '/earnings-visualizer',
    color: 'text-cyan-400 bg-cyan-400/10',
  },
  {
    icon: Activity,
    label: 'Economic Calendar',
    description: 'CPI, FOMC, GDP & more',
    path: '/economic-calendar',
    color: 'text-rose-400 bg-rose-400/10',
  },
  {
    icon: BarChart,
    label: 'EPS & Valuation',
    description: 'P/E, EPS, forward estimates',
    path: '/eps-valuation',
    color: 'text-indigo-400 bg-indigo-400/10',
  },
  {
    icon: BookOpen,
    label: 'Equity Research',
    description: 'Fundamentals & analyst data',
    path: '/research',
    color: 'text-purple bg-purple/10',
  },
  {
    icon: Zap,
    label: 'ETF Flows',
    description: 'Holdings & flow data',
    path: '/etf-flows',
    color: 'text-yellow-400 bg-yellow-400/10',
  },
  {
    icon: GitCompare,
    label: 'P/E Analyzer',
    description: 'Historical P/E comparison',
    path: '/pe-analyzer',
    color: 'text-orange-400 bg-orange-400/10',
  },
  {
    icon: BarChart,
    label: 'Profitability Compare',
    description: 'Side-by-side multi-ticker',
    path: '/profitability-compare',
    color: 'text-emerald-400 bg-emerald-400/10',
  },
  {
    icon: Search,
    label: 'Screener',
    description: 'Filter by sector & stats',
    path: '/scanner',
    color: 'text-accent bg-accent/10',
  },
  {
    icon: LineChart,
    label: 'Technicals',
    description: 'RSI, MACD, SMA signals',
    path: '/technicals',
    color: 'text-pink-400 bg-pink-400/10',
  },
  // ── Existing features ────────────────────────
  {
    icon: TrendingUp,
    label: 'Top 10',
    description: 'Top gainers & losers',
    path: '/top10',
    color: 'text-green bg-green/10',
  },
  {
    icon: LineChart,
    label: 'Options',
    description: 'Calls & puts chain',
    path: '/options',
    color: 'text-gold bg-gold/10',
  },
  {
    icon: Briefcase,
    label: 'Portfolio',
    description: 'Holdings & P&L tracker',
    path: '/portfolio',
    color: 'text-cyan-400 bg-cyan-400/10',
  },
  {
    icon: Bell,
    label: 'Alerts',
    description: 'Price target alerts',
    path: '/alerts',
    color: 'text-yellow-400 bg-yellow-400/10',
  },
  {
    icon: Bot,
    label: 'AI Copilot',
    description: 'Claude market analysis',
    path: '/copilot',
    color: 'text-pink-400 bg-pink-400/10',
  },
];

export function MorePage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 bg-bg-primary min-h-full">
      {/* Morning Brief slide deck */}
      <MarketBrief />

      {/* Feature grid */}
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Features</h2>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <button
            key={f.path + f.label}
            onClick={() => !f.comingSoon && navigate(f.path)}
            className="relative flex flex-col items-start gap-3 p-4 bg-bg-card border border-border-dim rounded-xl hover:border-accent/40 active:bg-bg-hover transition-colors text-left disabled:pointer-events-none"
            disabled={f.comingSoon}
          >
            {f.comingSoon && (
              <span className="absolute top-2 right-2 text-[9px] font-semibold text-text-muted bg-bg-hover px-1.5 py-0.5 rounded uppercase tracking-wide">
                Soon
              </span>
            )}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${f.color}`}>
              <f.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{f.label}</p>
              <p className="text-[11px] text-text-muted leading-snug mt-0.5">{f.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
