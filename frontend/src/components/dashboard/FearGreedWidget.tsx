import clsx from 'clsx';
import { useFearGreed } from '../../hooks/useMarketData';

function getColor(value: number): string {
  if (value <= 25) return '#ef4444';
  if (value <= 45) return '#f59e0b';
  if (value <= 55) return '#9ca3af';
  if (value <= 75) return '#84cc16';
  return '#22c55e';
}

function getLabel(text: string): string {
  const map: Record<string, string> = {
    'Extreme Fear': 'Extreme Fear',
    Fear: 'Fear',
    Neutral: 'Neutral',
    Greed: 'Greed',
    'Extreme Greed': 'Extreme Greed',
  };
  return map[text] || text;
}

interface GaugeProps {
  value: number;
}

function Gauge({ value }: GaugeProps) {
  const color = getColor(value);
  // SVG semi-circle gauge
  const radius = 45;
  const cx = 60;
  const cy = 60;
  const startAngle = -180;
  const endAngle = 0;
  const totalArc = endAngle - startAngle; // 180°
  const fillAngle = startAngle + (value / 100) * totalArc;

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const start = polarToXY(startAngle, radius);
  const end = polarToXY(endAngle, radius);
  const fill = polarToXY(fillAngle, radius);
  const largeArcBg = 1;
  const largeArcFill = fillAngle - startAngle > 180 ? 1 : 0;

  // Needle
  const needleAngle = startAngle + (value / 100) * totalArc;
  const needleTip = polarToXY(needleAngle, radius - 6);

  return (
    <svg viewBox="0 0 120 80" className="w-full max-w-[160px]">
      {/* Background arc */}
      <path
        d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcBg} 1 ${end.x} ${end.y}`}
        fill="none"
        stroke="#1f2937"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill arc */}
      {value > 0 && (
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFill} 1 ${fill.x} ${fill.y}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
        />
      )}
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill="#374151" stroke="white" strokeWidth="1.5" />
      {/* Value text */}
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="13" fontWeight="bold" fill="white" fontFamily="JetBrains Mono, monospace">
        {value}
      </text>
    </svg>
  );
}

export function FearGreedWidget() {
  const { data, isLoading } = useFearGreed();

  if (isLoading) {
    return (
      <div className="bg-bg-card border border-border-dim rounded-lg p-4 space-y-3">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-2.5 w-24" />
      </div>
    );
  }

  const now = data?.fgi?.now;
  const value = now?.value ?? 50;
  const text = now?.valueText ?? 'Neutral';
  const color = getColor(value);
  const isFallback = data?._fallback;

  const history = [
    { label: 'Prev Close', data: data?.fgi?.previousClose },
    { label: '1 Week Ago', data: data?.fgi?.oneWeekAgo },
    { label: '1 Month Ago', data: data?.fgi?.oneMonthAgo },
  ];

  return (
    <div className="bg-bg-card border border-border-dim rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-muted uppercase tracking-widest">Fear & Greed Index</span>
        {isFallback && (
          <span className="text-xs text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">demo</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Gauge value={value} />
        <div>
          <div className="text-sm font-bold" style={{ color }}>{getLabel(text)}</div>
          <div className="text-xs text-text-muted mt-1">Current</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {history.map(({ label, data: h }) =>
          h ? (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-text-muted">{label}</span>
              <span className="font-medium num" style={{ color: getColor(h.value) }}>
                {h.value} · {h.valueText}
              </span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
