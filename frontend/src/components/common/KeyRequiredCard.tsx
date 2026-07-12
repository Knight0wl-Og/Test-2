import { KeyRound, Lock } from 'lucide-react';

type Provider = 'fmp' | 'finnhub' | 'gemini' | 'polygon';

const PROVIDER_INFO: Record<Provider, { name: string; url: string }> = {
  fmp: { name: 'FMP', url: 'https://site.financialmodelingprep.com/developer/docs' },
  finnhub: { name: 'Finnhub', url: 'https://finnhub.io/register' },
  gemini: { name: 'Gemini', url: 'https://aistudio.google.com/apikey' },
  polygon: { name: 'Polygon', url: 'https://polygon.io/dashboard/signup' },
};

interface KeyRequiredCardProps {
  provider: Provider;
  reason?: 'missing-key' | 'paid-plan';
  feature?: string;
}

export function KeyRequiredCard({ provider, reason = 'missing-key', feature }: KeyRequiredCardProps) {
  const info = PROVIDER_INFO[provider];

  if (reason === 'paid-plan') {
    return (
      <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
        <Lock className="w-5 h-5 text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-amber-300 font-medium mb-1">
          {feature ? `${feature} requires` : 'Requires'} a paid {info.name} plan
        </p>
        <p className="text-xs text-text-muted">
          The free {info.name} tier does not include this data. Everything else in TradeEdge works without it.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-4 text-center">
      <KeyRound className="w-5 h-5 text-amber-400 mx-auto mb-2" />
      <p className="text-sm text-amber-300 font-medium mb-1">{info.name} API Key Required</p>
      <p className="text-xs text-text-muted">
        Add your free {info.name} key in Settings{feature ? ` to use ${feature}` : ''}
      </p>
    </div>
  );
}
