import { useState } from 'react';
import clsx from 'clsx';
import { LayoutDashboard } from 'lucide-react';
import { ChartPane } from './ChartPane';
import { useWatchlistStore } from '../../store/watchlistStore';

type LayoutPreset = '1x1' | '2x1' | '2x2';

const PRESETS: { id: LayoutPreset; label: string; grid: string; count: number }[] = [
  { id: '1x1', label: '1', grid: 'grid-cols-1 grid-rows-1', count: 1 },
  { id: '2x1', label: '2', grid: 'grid-cols-2 grid-rows-1', count: 2 },
  { id: '2x2', label: '4', grid: 'grid-cols-2 grid-rows-2', count: 4 },
];

interface ChartWorkspaceProps {
  className?: string;
}

export function ChartWorkspace({ className }: ChartWorkspaceProps) {
  const [preset, setPreset] = useState<LayoutPreset>('1x1');
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol);

  const activePreset = PRESETS.find((p) => p.id === preset)!;

  return (
    <div className={clsx('flex flex-col min-h-0', className)}>
      {/* Workspace toolbar — desktop only */}
      <div className="hidden lg:flex items-center justify-end gap-1 px-2 h-7 bg-bg-secondary border-b border-panel shrink-0">
        <span className="text-[10px] text-text-muted mr-1 flex items-center gap-1">
          <LayoutDashboard className="w-3 h-3" />
          Layout
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            title={`${p.label} chart${p.count > 1 ? 's' : ''}`}
            className={clsx(
              'w-6 h-5 rounded text-[10px] font-mono transition-colors',
              preset === p.id
                ? 'bg-accent text-white'
                : 'text-text-muted hover:bg-bg-hover hover:text-gray-200'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart grid */}
      <div
        className={clsx(
          'flex-1 min-h-0 grid gap-px bg-border-panel',
          // Mobile always single pane
          'grid-cols-1 grid-rows-1',
          // Desktop applies preset
          `lg:${activePreset.grid}`
        )}
      >
        {Array.from({ length: activePreset.count }).map((_, i) => (
          <ChartPane
            key={i}
            // First pane follows global selected symbol, others start independent
            defaultSymbol={i === 0 ? (selectedSymbol ?? 'AAPL') : undefined}
            showHeader={true}
            className="min-h-0"
          />
        ))}
      </div>
    </div>
  );
}
