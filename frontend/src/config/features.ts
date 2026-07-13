/**
 * Single source of truth for app navigation.
 * Consumed by Sidebar (desktop rail), MorePage (mobile grid) and ProLayout
 * (route map) — previously each kept its own diverging hardcoded list.
 */
import {
  LayoutDashboard, Search, BookOpen, Bot,
  TrendingUp, Briefcase, Bell, LineChart,
  Calendar, BarChart2, PieChart, Activity,
  BarChart, DollarSign, Zap, GitCompare, Newspaper, Layers, Sunrise,
  type LucideIcon,
} from 'lucide-react';

export interface Feature {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the MorePage tile icon */
  color: string;
  group: 'core' | 'research';
}

export const FEATURES: Feature[] = [
  // ── Core ──────────────────────────────────────────────────────────────
  { id: 'dashboard', path: '/', label: 'Dashboard', description: 'Market overview & heatmap', icon: LayoutDashboard, color: 'text-accent bg-accent/10', group: 'core' },
  { id: 'brief', path: '/brief', label: 'Morning Brief', description: 'Daily pre-market report', icon: Sunrise, color: 'text-gold bg-gold/10', group: 'core' },
  { id: 'top10', path: '/top10', label: 'Top 10', description: 'Top gainers & losers', icon: TrendingUp, color: 'text-green bg-green/10', group: 'core' },
  { id: 'scanner', path: '/scanner', label: 'Screener', description: 'Market-wide stock scanner', icon: Search, color: 'text-accent bg-accent/10', group: 'core' },
  { id: 'options', path: '/options', label: 'Options', description: 'Calls & puts chain', icon: LineChart, color: 'text-gold bg-gold/10', group: 'core' },
  { id: 'copilot', path: '/copilot', label: 'AI Copilot', description: 'Claude market analysis', icon: Bot, color: 'text-pink-400 bg-pink-400/10', group: 'core' },
  { id: 'alerts', path: '/alerts', label: 'Alerts', description: 'Price target alerts', icon: Bell, color: 'text-yellow-400 bg-yellow-400/10', group: 'core' },
  { id: 'portfolio', path: '/portfolio', label: 'Portfolio', description: 'Holdings & P&L tracker', icon: Briefcase, color: 'text-cyan-400 bg-cyan-400/10', group: 'core' },

  // ── Research ──────────────────────────────────────────────────────────
  { id: 'research', path: '/research', label: 'Equity Research', description: 'Fundamentals & analyst data', icon: BookOpen, color: 'text-purple bg-purple/10', group: 'research' },
  { id: 'earnings', path: '/earnings', label: 'Earnings', description: 'Weekly earnings calendar', icon: Calendar, color: 'text-amber-400 bg-amber-400/10', group: 'research' },
  { id: 'earnings-predictor', path: '/earnings-predictor', label: 'Earnings Predictor', description: 'EPS history & beat rate', icon: BarChart2, color: 'text-purple bg-purple/10', group: 'research' },
  { id: 'earnings-visualizer', path: '/earnings-visualizer', label: 'Earnings Visualizer', description: 'Revenue & EPS charts', icon: PieChart, color: 'text-cyan-400 bg-cyan-400/10', group: 'research' },
  { id: 'economic-calendar', path: '/economic-calendar', label: 'Economic Calendar', description: 'CPI, FOMC, GDP & more', icon: Activity, color: 'text-rose-400 bg-rose-400/10', group: 'research' },
  { id: 'eps-valuation', path: '/eps-valuation', label: 'EPS & Valuation', description: 'P/E, EPS, forward estimates', icon: BarChart, color: 'text-indigo-400 bg-indigo-400/10', group: 'research' },
  { id: 'etf-flows', path: '/etf-flows', label: 'ETF Flows', description: 'Holdings & flow data', icon: Zap, color: 'text-yellow-400 bg-yellow-400/10', group: 'research' },
  { id: 'pe-analyzer', path: '/pe-analyzer', label: 'P/E Analyzer', description: 'Historical P/E comparison', icon: GitCompare, color: 'text-orange-400 bg-orange-400/10', group: 'research' },
  { id: 'profitability-compare', path: '/profitability-compare', label: 'Profitability Compare', description: 'Side-by-side multi-ticker', icon: BarChart, color: 'text-emerald-400 bg-emerald-400/10', group: 'research' },
  { id: 'dividends', path: '/dividends', label: 'Dividends', description: 'History, yield & calendar', icon: DollarSign, color: 'text-green bg-green/10', group: 'research' },
  { id: 'covered-call-etfs', path: '/covered-call-etfs', label: 'Covered Call ETFs', description: 'QYLD, JEPI, JEPQ & more', icon: Layers, color: 'text-teal-400 bg-teal-400/10', group: 'research' },
  { id: 'intel-library', path: '/intel-library', label: 'Intel Library', description: 'Market news & analysis', icon: Newspaper, color: 'text-sky-400 bg-sky-400/10', group: 'research' },
  { id: 'technicals', path: '/technicals', label: 'Technicals', description: 'RSI, MACD, EMA signals', icon: Activity, color: 'text-pink-400 bg-pink-400/10', group: 'research' },
];

/** id → path, derived from FEATURES */
export const ROUTE_MAP: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f.path])
);
