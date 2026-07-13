/**
 * Mobile "More" tab — Morning Brief preview card at top, then all features
 * as a grid. Feature list comes from the shared config (config/features.ts).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sunrise, ChevronRight } from 'lucide-react';
import { fetchMarketStatus } from '../services/api';
import { FEATURES } from '../config/features';
import { SectionLabel } from '../components/common/SectionLabel';

// Dashboard is the desktop chart workspace and the brief has its own hero
// card + bottom tab — both excluded from the grid.
const GRID_FEATURES = FEATURES.filter((f) => f.id !== 'dashboard' && f.id !== 'brief');

function BriefPreviewCard() {
  const navigate = useNavigate();
  const { data: status } = useQuery({
    queryKey: ['brief-status'],
    queryFn: fetchMarketStatus,
    staleTime: 60_000,
  });

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <button
      onClick={() => navigate('/brief')}
      className="w-full flex items-center gap-3 p-4 mb-5 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/15 via-bg-card to-bg-card hover:border-gold/50 active:bg-bg-hover transition-colors text-left shadow-card"
    >
      <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0">
        <Sunrise className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Morning Brief</p>
        <p className="text-[11px] text-text-muted leading-snug">
          {dateLabel} · Markets {status?.marketOpen ? 'open' : 'closed'} · Futures, macro, earnings &amp; AI commentary
        </p>
      </div>
      <span className="flex items-center gap-0.5 text-[11px] text-gold font-medium shrink-0">
        Read <ChevronRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

export function MorePage() {
  const navigate = useNavigate();

  // One-time cleanup of the old slide-deck cache
  useEffect(() => {
    localStorage.removeItem('tradeedge_morning_brief_v2');
  }, []);

  return (
    <div className="p-4 bg-bg-primary min-h-full">
      <BriefPreviewCard />

      {/* Feature grid */}
      <SectionLabel className="mb-3">Features</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {GRID_FEATURES.map((f) => (
          <button
            key={f.id}
            onClick={() => navigate(f.path)}
            className="relative flex flex-col items-start gap-3 p-4 card-surface hover:border-accent/40 active:bg-bg-hover transition-colors text-left"
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
