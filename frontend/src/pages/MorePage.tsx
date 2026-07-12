/**
 * Mobile "More" tab — Market Brief at top, then all features as a grid.
 * Feature list comes from the shared config (config/features.ts).
 */
import { useNavigate } from 'react-router-dom';
import { FEATURES } from '../config/features';
import { MarketBrief } from '../components/more/MarketBrief';

// Dashboard is the desktop chart workspace — mobile users reach the chart
// from the bottom nav, so it's excluded from the grid.
const GRID_FEATURES = FEATURES.filter((f) => f.id !== 'dashboard');

export function MorePage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 bg-bg-primary min-h-full">
      {/* Morning Brief slide deck */}
      <MarketBrief />

      {/* Feature grid */}
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Features</h2>
      <div className="grid grid-cols-2 gap-3">
        {GRID_FEATURES.map((f) => (
          <button
            key={f.id}
            onClick={() => navigate(f.path)}
            className="relative flex flex-col items-start gap-3 p-4 bg-bg-card border border-border-dim rounded-xl hover:border-accent/40 active:bg-bg-hover transition-colors text-left"
          >
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
