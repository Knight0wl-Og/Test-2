import { LayoutDashboard, LineChart, Search, BookOpen, Bot, BarChart2, Briefcase, Bell } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Search, label: 'Scanner', id: 'scanner', disabled: true },
  { icon: BookOpen, label: 'Research', id: 'research', disabled: true },
  { icon: BarChart2, label: 'Options', id: 'options', disabled: true },
  { icon: LineChart, label: 'Top 10', id: 'top10', disabled: true },
  { icon: Bot, label: 'AI Copilot', id: 'copilot', disabled: true },
  { icon: Bell, label: 'Alerts', id: 'alerts', disabled: true },
  { icon: Briefcase, label: 'Portfolio', id: 'portfolio', disabled: true },
];

interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
}

export function Sidebar({ active = 'dashboard', onNavigate }: SidebarProps) {
  return (
    <nav className="w-14 bg-bg-secondary border-r border-border-dim flex flex-col items-center py-3 gap-1 shrink-0">
      {NAV_ITEMS.map(({ icon: Icon, label, id, disabled }) => (
        <button
          key={id}
          title={label}
          disabled={disabled}
          onClick={() => !disabled && onNavigate?.(id)}
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group',
            active === id
              ? 'bg-accent/20 text-accent'
              : disabled
              ? 'text-text-muted/30 cursor-not-allowed'
              : 'text-text-muted hover:bg-bg-hover hover:text-gray-200'
          )}
        >
          <Icon className="w-4.5 h-4.5" size={18} />
          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 bg-bg-card border border-border-dim rounded text-xs text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            {label}
            {disabled && <span className="text-text-muted ml-1">(soon)</span>}
          </span>
        </button>
      ))}
    </nav>
  );
}
