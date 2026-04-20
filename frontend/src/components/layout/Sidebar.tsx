import {
  LayoutDashboard, Search, BookOpen, Bot,
  TrendingUp, Briefcase, Bell, LineChart,
  Calendar, BarChart2, PieChart, Activity,
  BarChart, DollarSign, Zap, GitCompare, Newspaper,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
  icon: LucideIcon;
  label: string;
  id: string;
}

const CORE_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',  id: 'dashboard' },
  { icon: TrendingUp,      label: 'Top 10',     id: 'top10' },
  { icon: Search,          label: 'Screener',   id: 'scanner' },
  { icon: LineChart,       label: 'Options',    id: 'options' },
  { icon: Bot,             label: 'AI Copilot', id: 'copilot' },
  { icon: Bell,            label: 'Alerts',     id: 'alerts' },
  { icon: Briefcase,       label: 'Portfolio',  id: 'portfolio' },
];

const RESEARCH_NAV: NavItem[] = [
  { icon: BookOpen,   label: 'Equity Research',       id: 'research' },
  { icon: Calendar,   label: 'Earnings',              id: 'earnings' },
  { icon: BarChart2,  label: 'Earnings Predictor',    id: 'earnings-predictor' },
  { icon: PieChart,   label: 'Earnings Visualizer',   id: 'earnings-visualizer' },
  { icon: Activity,   label: 'Economic Calendar',     id: 'economic-calendar' },
  { icon: BarChart,   label: 'EPS & Valuation',       id: 'eps-valuation' },
  { icon: Zap,        label: 'ETF Flows',             id: 'etf-flows' },
  { icon: GitCompare, label: 'P/E Analyzer',          id: 'pe-analyzer' },
  { icon: BarChart,   label: 'Profitability Compare', id: 'profitability-compare' },
  { icon: DollarSign, label: 'Dividends',             id: 'dividends' },
  { icon: Newspaper,  label: 'Intel Library',         id: 'intel-library' },
  { icon: Activity,   label: 'Technicals',            id: 'technicals' },
];

interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
}

function NavBtn({ item, active, onNavigate }: { item: NavItem; active: string; onNavigate?: (id: string) => void }) {
  const { icon: Icon, label, id } = item;
  return (
    <button
      key={id}
      title={label}
      onClick={() => onNavigate?.(id)}
      className={clsx(
        'w-8 h-8 rounded flex items-center justify-center transition-colors relative group',
        active === id
          ? 'bg-accent/20 text-accent'
          : 'text-text-muted hover:bg-bg-hover hover:text-gray-200'
      )}
    >
      <Icon size={15} />
      <span className="absolute left-full ml-2 px-2 py-1 bg-bg-card border border-border-dim rounded text-[11px] text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        {label}
      </span>
    </button>
  );
}

export function Sidebar({ active = 'dashboard', onNavigate }: SidebarProps) {
  return (
    <nav className="hidden lg:flex w-10 bg-bg-secondary border-r border-panel flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto">
      {CORE_NAV.map((item) => (
        <NavBtn key={item.id} item={item} active={active} onNavigate={onNavigate} />
      ))}

      {/* Research hub separator */}
      <div className="w-6 h-px bg-border-dim/60 my-1.5" />
      <span className="text-[8px] text-text-muted/40 uppercase tracking-widest mb-0.5 font-semibold">R</span>

      {RESEARCH_NAV.map((item) => (
        <NavBtn key={item.id} item={item} active={active} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
