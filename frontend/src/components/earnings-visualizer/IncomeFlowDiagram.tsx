import { forwardRef } from 'react';
import type { FMPIncomeStatement } from '../../services/fmpService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLarge(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(num: number, den: number): string {
  return ((num / den) * 100).toFixed(1) + '%';
}

function fmtYoY(curr: number, prev: number): string {
  if (!prev) return '';
  const p = ((curr - prev) / Math.abs(prev)) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(0) + '% Y/Y';
}

// Cubic Bézier path between two horizontal edges
function flowPath(
  x1: number, y1top: number, y1bot: number,
  x2: number, y2top: number, y2bot: number
): string {
  const cx = (x1 + x2) / 2;
  return [
    `M ${x1} ${y1top}`,
    `C ${cx} ${y1top} ${cx} ${y2top} ${x2} ${y2top}`,
    `L ${x2} ${y2bot}`,
    `C ${cx} ${y2bot} ${cx} ${y1bot} ${x1} ${y1bot}`,
    'Z',
  ].join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: FMPIncomeStatement;
  prev: FMPIncomeStatement | null;
  watermark?: string;
}

export const IncomeFlowDiagram = forwardRef<SVGSVGElement, Props>(
  ({ data, prev, watermark = 'TradeEdge' }, ref) => {
    const W = 780, H = 360;
    const BAR_W = 80;
    const TOP_PAD = 40, BOT_PAD = 50;
    const CHART_H = H - TOP_PAD - BOT_PAD;

    const revenue = data.revenue;
    const grossProfit = data.grossProfit;
    const operatingIncome = data.operatingIncome;
    const netIncome = data.netIncome;
    const eps = data.epsDiluted;

    const costOfRevenue = revenue - grossProfit;
    const operatingCosts = grossProfit - operatingIncome;
    const tax = operatingIncome - netIncome;

    // Bar heights as proportion of revenue
    const toH = (v: number) => Math.max(4, (v / revenue) * CHART_H);

    // Bar X positions (evenly distributed)
    const barXs = [80, 260, 440, 620];

    // Each bar starts at BOT_PAD from bottom, height proportional to value
    const barValues = [revenue, grossProfit, operatingIncome, netIncome];
    const barHeights = barValues.map(toH);
    const barTops = barHeights.map((h) => H - BOT_PAD - h);
    const barBots = barHeights.map(() => H - BOT_PAD);

    const DARK_BG = '#0a0e1a';
    const GREEN   = '#22c55e';
    const GREEN_DARK = '#16a34a';
    const PINK    = 'rgba(248,113,113,0.45)';
    const GOLD    = '#f59e0b';
    const GRAY    = '#6b7280';

    const periodLabel = data.date
      ? new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        })
      : '';

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ background: '#f0f0e8', borderRadius: 12 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background */}
        <rect width={W} height={H} fill="#f0f0e8" />

        {/* Period label */}
        <text x={W - 16} y={22} textAnchor="end" fill={GRAY} fontSize="11" fontFamily="monospace">
          {data.period?.toUpperCase()} (ended {periodLabel})
        </text>

        {/* EPS badge */}
        <rect x={W - 80} y={28} width={64} height={28} rx="6" fill={GOLD} />
        <text x={W - 80 + 8} y={38} fill="#fff" fontSize="8" fontFamily="sans-serif" fontWeight="bold">EPS</text>
        <text x={W - 80 + 8} y={51} fill="#fff" fontSize="12" fontFamily="monospace" fontWeight="bold">
          ${eps?.toFixed(2) ?? '—'}
        </text>

        {/* Cost flow paths (pink bands between bars) */}
        {/* Cost of Revenue: between Revenue and GrossProfit */}
        <path
          d={flowPath(
            barXs[0] + BAR_W, barTops[0], barBots[0],  // right edge of Revenue
            barXs[1],         H - BOT_PAD - toH(costOfRevenue), H - BOT_PAD  // left edge of CostOfRev band
          )}
          fill={PINK}
        />
        {/* Operating Costs: between GrossProfit and OperatingIncome */}
        <path
          d={flowPath(
            barXs[1] + BAR_W, barTops[1], H - BOT_PAD - toH(costOfRevenue),
            barXs[2],         H - BOT_PAD - toH(operatingCosts), H - BOT_PAD
          )}
          fill={PINK}
        />
        {/* Tax: between OperatingIncome and NetIncome */}
        <path
          d={flowPath(
            barXs[2] + BAR_W, barTops[2], H - BOT_PAD - toH(tax),
            barXs[3],         H - BOT_PAD - toH(tax), H - BOT_PAD
          )}
          fill={PINK}
        />

        {/* Bars */}
        {barValues.map((val, i) => (
          <g key={i}>
            <rect x={barXs[i]} y={barTops[i]} width={BAR_W} height={barHeights[i]}
              fill={i === 0 ? GREEN : GREEN_DARK} rx="2" />
          </g>
        ))}

        {/* Bar labels */}
        {[
          { label: 'Revenue', val: revenue, prevVal: prev?.revenue },
          { label: 'Gross Profit', val: grossProfit, prevVal: prev?.grossProfit, margin: true },
          { label: 'Operating Income', val: operatingIncome, prevVal: prev?.operatingIncome, margin: true },
          { label: 'Net Income', val: netIncome, prevVal: prev?.netIncome, margin: true },
        ].map(({ label, val, prevVal, margin }, i) => (
          <g key={i}>
            <text x={barXs[i] + BAR_W / 2} y={barTops[i] - 20} textAnchor="middle"
              fill="#1e293b" fontSize="10" fontFamily="sans-serif" fontWeight="600">{label}</text>
            <text x={barXs[i] + BAR_W / 2} y={barTops[i] - 8} textAnchor="middle"
              fill={GOLD} fontSize="13" fontFamily="monospace" fontWeight="bold">{fmtLarge(val)}</text>
            {margin && (
              <text x={barXs[i] + BAR_W / 2} y={barTops[i] + 14} textAnchor="middle"
                fill="#fff" fontSize="9" fontFamily="sans-serif">
                Margin: {fmtPct(val, revenue)}
              </text>
            )}
            {prevVal != null && (
              <text x={barXs[i] + BAR_W / 2} y={H - BOT_PAD + 14} textAnchor="middle"
                fill={GRAY} fontSize="9" fontFamily="sans-serif">{fmtYoY(val, prevVal)}</text>
            )}
          </g>
        ))}

        {/* Cost flow labels */}
        <text x={(barXs[0] + BAR_W + barXs[1]) / 2} y={H - BOT_PAD + 28}
          textAnchor="middle" fill="#b91c1c" fontSize="9" fontFamily="sans-serif">
          Cost of Revenue {fmtLarge(costOfRevenue)}
        </text>
        <text x={(barXs[1] + BAR_W + barXs[2]) / 2} y={H - BOT_PAD + 28}
          textAnchor="middle" fill="#b91c1c" fontSize="9" fontFamily="sans-serif">
          Operating Costs {fmtLarge(operatingCosts)}
        </text>
        <text x={(barXs[2] + BAR_W + barXs[3]) / 2} y={H - BOT_PAD + 28}
          textAnchor="middle" fill="#b91c1c" fontSize="9" fontFamily="sans-serif">
          Tax {fmtLarge(tax)}
        </text>

        {/* Source + watermark */}
        <text x={16} y={H - 8} fill={GRAY} fontSize="8" fontFamily="sans-serif">
          Source: Financial Modeling Prep
        </text>
        <text x={W - 16} y={H - 8} textAnchor="end" fill={GRAY} fontSize="11"
          fontFamily="Georgia, serif" fontStyle="italic">{watermark}</text>
      </svg>
    );
  }
);

IncomeFlowDiagram.displayName = 'IncomeFlowDiagram';
