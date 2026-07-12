import clsx from 'clsx';
import { FEATURES, type Feature } from '../../config/features';

const CORE_NAV = FEATURES.filter((f) => f.group === 'core');
const RESEARCH_NAV = FEATURES.filter((f) => f.group === 'research');

interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
}

function NavBtn({ item, active, onNavigate }: { item: Feature; active: string; onNavigate?: (id: string) => void }) {
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
