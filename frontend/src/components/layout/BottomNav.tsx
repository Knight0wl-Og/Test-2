import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart2, List, Calendar, Newspaper, Search, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { tap } from '../../services/haptics';

const TABS = [
  { id: 'chart',     label: 'Chart',     icon: BarChart2,     path: '/'          },
  { id: 'watchlist', label: 'Watchlist', icon: List,          path: '/watchlist' },
  { id: 'earnings',  label: 'Earnings',  icon: Calendar,      path: '/earnings'  },
  { id: 'news',      label: 'News',      icon: Newspaper,     path: '/news'      },
  { id: 'scanner',   label: 'Screener',  icon: Search,        path: '/scanner'   },
  { id: 'more',      label: 'More',      icon: MoreHorizontal,path: '/more'      },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  function isActive(path: string): boolean {
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  function handleTab(path: string) {
    tap();
    navigate(path);
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-panel flex items-stretch h-14">
      {TABS.map(({ id, label, icon: Icon, path }) => (
        <button
          key={id}
          onClick={() => handleTab(path)}
          className={clsx(
            'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
            isActive(path) ? 'text-accent' : 'text-text-muted'
          )}
        >
          <Icon size={20} />
          <span className="text-[9px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}
