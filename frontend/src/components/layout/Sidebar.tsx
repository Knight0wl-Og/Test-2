import {
  LayoutDashboard, Search, BookOpen, Bot,
  TrendingUp, Briefcase, Bell, LineChart,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',  id: 'dashboard' },
  { icon: TrendingUp,      label: 'Top 10',     id: 'top10' },
  { icon: Search,          label: 'Scanner',    id: 'scanner' },
  { icon: BookOpen,        label: 'Research',   id: 'research' },
  { icon: LineChart,       label: 'Options',    id: 'options' },
  { icon: Bot,             label: 'AI Copilot', id: 'copilot' },
  { icon: Bell,            label: 'Alerts',     id: 'alerts' },
  { icon: Briefcase,       label: 'Portfolio',  id: 'portfolio' },
];

interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
}

export function Sidebar({ active = 'dashboard', onNavigate }: SidebarProps) {
  return (
    <nav className="hidden lg:flex w-10 bg-bg-secondary border-r border-panel flex-col items-center py-2 gap-0.5 shrink-0">
      {NAV_ITEMS.map(({ icon: Icon, label, id }) => (
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
          <Icon size={16} />
          <span className="absolute left-full ml-2 px-2 py-1 bg-bg-card border border-border-dim rounded text-[11px] text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}
