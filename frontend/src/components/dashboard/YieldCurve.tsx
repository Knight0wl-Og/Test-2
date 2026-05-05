import { useQuery } from '@tanstack/react-query';
import { fetchBatchQuotes } from '../../services/api';

// Yahoo Finance symbols for Treasury yields
const YIELD_SYMBOLS = ['^IRX', '^FVX', '^TNX', '^TYX'];
const YIELD_LABELS  = ['3M',   '5Y',  '10Y', '30Y'];

// Approximate 1Y and 2Y from FMP treasury or interpolate — we fetch what Yahoo gives us
// and map to maturities in years for plotting
const MATURITY_YEARS = [0.25, 5, 10, 30]; // matches YIELD_SYMBOLS

function getShapeLabel(points: { y: number }[]): { label: string; color: string } {
  if (points.length < 2) return { label: '—', color: '#9ca3af' };
  const short = points[0].y;
  const long  = points[points.length - 1].y;
  const mid   = points[Math.floor(points.length / 2)].y;
  if (long > short + 0.3) return { label: 'NORMAL', color: '#22c55e' };
  if (short > long + 0.1) return { label: 'INVERTED', color: '#f87171' };
  if (Math.abs(long - short) < 0.3 && Math.abs(mid - short) < 0.3)
    return { label: 'FLAT', color: '#fbbf24' };
  return { label: 'HUMPED', color: '#60a5fa' };
}

export function YieldCurve() {
  const { data: quotes = [] } = useQuery({
    queryKey: ['yield-curve'],
    queryFn: () => fetchBatchQuotes(YIELD_SYMBOLS),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (quotes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500">
        Loading yield curve…
      </div>
    );
  }

  // Build points array ordered by maturity
  const points = YIELD_SYMBOLS.map((sym, i) => {
    const q = quotes.find((q) => q.symbol === sym);
    return { label: YIELD_LABELS[i], x: MATURITY_YEARS[i], y: q?.price ?? 0 };
  }).filter((p) => p.y > 0);

  if (points.length < 2) return null;

  const { label: shapeLabel, color: shapeColor } = getShapeLabel(points);

  // SVG dimensions
  const W = 280, H = 90, PAD = { top: 8, right: 8, bottom: 20, left: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const minX = 0, maxX = 32;
  const minY = Math.min(...points.map((p) => p.y)) - 0.2;
  const maxY = Math.max(...points.map((p) => p.y)) + 0.2;

  const toSvgX = (x: number) => PAD.left + ((x - minX) / (maxX - minX)) * chartW;
  const toSvgY = (y: number) => PAD.top + (1 - (y - minY) / (maxY - minY)) * chartH;

  const polyPoints = points.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');

  // Build smooth path using cubic bezier
  const pathD = points.reduce((d, p, i) => {
    const x = toSvgX(p.x);
    const y = toSvgY(p.y);
    if (i === 0) return `M ${x} ${y}`;
    const prev = points[i - 1];
    const px = toSvgX(prev.x), py = toSvgY(prev.y);
    const cx = (px + x) / 2;
    return `${d} C ${cx} ${py} ${cx} ${y} ${x} ${y}`;
  }, '');

  return (
    <div className="flex flex-col h-full">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="flex-1">
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + t * chartH;
          const val = maxY - t * (maxY - minY);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="#1e2235" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end"
                fill="#6b7280" fontSize="7">{val.toFixed(2)}</text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {points.map((p) => (
          <text key={p.label} x={toSvgX(p.x)} y={H - 4} textAnchor="middle"
            fill="#6b7280" fontSize="7">{p.label}</text>
        ))}

        {/* Area fill */}
        <defs>
          <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shapeColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={shapeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${toSvgX(points[points.length - 1].x)} ${PAD.top + chartH} L ${toSvgX(points[0].x)} ${PAD.top + chartH} Z`}
          fill="url(#yieldGrad)"
        />

        {/* Curve line */}
        <path d={pathD} fill="none" stroke={shapeColor} strokeWidth="1.5" strokeLinecap="round" />

        {/* Data points */}
        {points.map((p) => (
          <circle key={p.label} cx={toSvgX(p.x)} cy={toSvgY(p.y)} r="2"
            fill={shapeColor} />
        ))}
      </svg>

      {/* Yield values row */}
      <div className="flex justify-between px-1 pb-1">
        {points.map((p) => (
          <div key={p.label} className="text-center">
            <p className="text-[9px] text-gray-500">{p.label}</p>
            <p className="text-[10px] font-mono text-white">{p.y.toFixed(2)}%</p>
          </div>
        ))}
        <div className="text-right">
          <p className="text-[9px] text-gray-500">Shape</p>
          <p className="text-[10px] font-semibold" style={{ color: shapeColor }}>{shapeLabel}</p>
        </div>
      </div>
    </div>
  );
}
