import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Briefcase, Bell } from 'lucide-react';
import clsx from 'clsx';
import { tap } from '../../services/haptics';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'top10',     label: 'Top 10',   icon: TrendingUp,     path: '/top10' },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase,      path: '/portfolio' },
  { id: 'alerts',    label: 'Alerts',    icon: Bell,           path: '/alerts' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  function handleTab(path: string) {
    tap();
    navigate(path);
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-border-dim flex items-stretch h-14">
      {TABS.map(({ id, label, icon: Icon, path }) => {
        const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
        return (
          <button
            key={id}
            onClick={() => handleTab(path)}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
              isActive ? 'text-accent' : 'text-text-muted hover:text-gray-300'
            )}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
