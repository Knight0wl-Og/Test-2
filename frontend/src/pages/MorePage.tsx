/**
 * Mobile "More" tab — grid of all secondary features.
 * Mirrors TradingView mobile's overflow menu.
 */
import { useNavigate } from 'react-router-dom';
import {
  Search, BookOpen, LineChart, Bot, Bell, Briefcase,
  TrendingUp, type LucideIcon,
} from 'lucide-react';

interface FeatureItem {
  icon: LucideIcon;
  label: string;
  description: string;
  path: string;
  color: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: TrendingUp,
    label: 'Top 10',
    description: 'Top gainers & losers',
    path: '/top10',
    color: 'text-green bg-green/10',
  },
  {
    icon: Search,
    label: 'Scanner',
    description: 'Filter by sector & stats',
    path: '/scanner',
    color: 'text-accent bg-accent/10',
  },
  {
    icon: BookOpen,
    label: 'Research',
    description: 'Fundamentals & analyst data',
    path: '/research',
    color: 'text-purple bg-purple/10',
  },
  {
    icon: LineChart,
    label: 'Options',
    description: 'Calls & puts chain',
    path: '/options',
    color: 'text-gold bg-gold/10',
  },
  {
    icon: Briefcase,
    label: 'Portfolio',
    description: 'Holdings & P&L tracker',
    path: '/portfolio',
    color: 'text-cyan-400 bg-cyan-400/10',
  },
  {
    icon: Bell,
    label: 'Alerts',
    description: 'Price target alerts',
    path: '/alerts',
    color: 'text-yellow-400 bg-yellow-400/10',
  },
  {
    icon: Bot,
    label: 'AI Copilot',
    description: 'Claude market analysis',
    path: '/copilot',
    color: 'text-pink-400 bg-pink-400/10',
  },
];

export function MorePage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 bg-bg-primary min-h-full">
      <h1 className="text-sm font-bold text-white mb-4">More</h1>
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <button
            key={f.path}
            onClick={() => navigate(f.path)}
            className="flex flex-col items-start gap-3 p-4 bg-bg-card border border-border-dim rounded-xl hover:border-accent/40 active:bg-bg-hover transition-colors text-left"
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
