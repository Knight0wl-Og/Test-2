import { forwardRef } from 'react';
import type { FMPCashFlowStatement } from '../../services/fmpService';

function fmtLarge(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtYoY(curr: number, prev: number): string {
  if (!prev) return '';
  const p = ((curr - prev) / Math.abs(prev)) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(0) + '% Y/Y';
}

interface Props {
  data: FMPCashFlowStatement;
  prev: FMPCashFlowStatement | null;
  watermark?: string;
}

export const CashFlowDiagram = forwardRef<SVGSVGElement, Props>(
  ({ data, prev, watermark = 'TradeEdge' }, ref) => {
    const W = 780, H = 340;
    const TOP_PAD = 40, BOT_PAD = 50;
    const CHART_H = H - TOP_PAD - BOT_PAD;

    const ocf     = Math.abs(data.operatingCashFlow ?? 0);
    const capex   = Math.abs(data.capitalExpenditure ?? 0);
    const fcf     = ocf - capex;
    const buybacks = Math.abs(data.commonStockRepurchased ?? 0);
    const retained = Math.max(0, fcf - buybacks);

    const maxVal = ocf;
    const toH = (v: number) => Math.max(4, (v / maxVal) * CHART_H);

    // Block positions
    const OCF_X   = 60,  OCF_W  = 120;
    const FCF_X   = 300, FCF_W  = 120;
    const RIGHT_X = 520, RIGHT_W = 120;

    const ocfH   = toH(ocf);
    const fcfH   = toH(fcf);
    const capexH = toH(capex);
    const buybackH = toH(buybacks);
    const retainedH = toH(retained);

    const BASE_Y  = H - BOT_PAD;
    const ocfTop  = BASE_Y - ocfH;
    const fcfTop  = BASE_Y - fcfH;
    const capexCurveYTop = BASE_Y - capexH; // CapEx flows from bottom of OCF bar

    // Right block: buybacks on top, retained below
    const buybackTop = BASE_Y - buybackH - retainedH;
    const retainedTop = BASE_Y - retainedH;

    const DARK_BG = '#f0f0e8';
    const GREEN_LIGHT = '#4ade80';
    const GREEN_DARK  = '#166534';
    const BLUE_LIGHT  = '#93c5fd';
    const PINK        = 'rgba(248,113,113,0.5)';
    const GOLD        = '#f59e0b';
    const GRAY        = '#6b7280';

    // FCF Margin
    const revenue = 1; // we don't have revenue here, skip margin
    const fcfMarginLabel = prev && prev.operatingCashFlow
      ? fmtYoY(ocf, Math.abs(prev.operatingCashFlow))
      : '';

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ background: DARK_BG, borderRadius: 12 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={W} height={H} fill={DARK_BG} />

        {/* Title */}
        <text x={16} y={22} fill="#1e293b" fontSize="13" fontFamily="sans-serif" fontWeight="700">
          Cash Flow Deployment
        </text>
        <text x={W - 16} y={22} textAnchor="end" fill={GRAY} fontSize="11" fontFamily="monospace">
          {data.date}
        </text>

        {/* CapEx pink outflow from bottom of OCF → curves down */}
        <path
          d={`M ${OCF_X + OCF_W} ${BASE_Y} C ${(OCF_X + OCF_W + FCF_X) / 2} ${BASE_Y} ${(OCF_X + OCF_W + FCF_X) / 2} ${BASE_Y + 40} ${FCF_X} ${BASE_Y + 40} L ${FCF_X} ${BASE_Y} L ${OCF_X + OCF_W} ${BASE_Y} Z`}
          fill={PINK}
        />

        {/* Flow from OCF to FCF (top connection) */}
        <path
          d={`M ${OCF_X + OCF_W} ${fcfTop} C ${(OCF_X + OCF_W + FCF_X) / 2} ${fcfTop} ${(OCF_X + OCF_W + FCF_X) / 2} ${fcfTop} ${FCF_X} ${fcfTop} L ${FCF_X} ${BASE_Y} L ${OCF_X + OCF_W} ${BASE_Y} Z`}
          fill="rgba(74,222,128,0.2)"
        />

        {/* Flow from FCF to right block */}
        <path
          d={`M ${FCF_X + FCF_W} ${fcfTop} C ${(FCF_X + FCF_W + RIGHT_X) / 2} ${fcfTop} ${(FCF_X + FCF_W + RIGHT_X) / 2} ${buybackTop} ${RIGHT_X} ${buybackTop} L ${RIGHT_X} ${BASE_Y} L ${FCF_X + FCF_W} ${BASE_Y} Z`}
          fill="rgba(74,222,128,0.15)"
        />

        {/* OCF Bar */}
        <rect x={OCF_X} y={ocfTop} width={OCF_W} height={ocfH} fill={GREEN_LIGHT} rx="3" />

        {/* FCF Bar */}
        <rect x={FCF_X} y={fcfTop} width={FCF_W} height={fcfH} fill={GREEN_LIGHT} rx="3" />

        {/* Right block: Buybacks (blue) */}
        {buybackH > 4 && (
          <rect x={RIGHT_X} y={buybackTop} width={RIGHT_W} height={buybackH} fill={BLUE_LIGHT} rx="3" />
        )}

        {/* Right block: Retained (dark green) */}
        {retainedH > 4 && (
          <rect x={RIGHT_X} y={retainedTop} width={RIGHT_W} height={retainedH} fill={GREEN_DARK} rx="3" />
        )}

        {/* OCF Labels */}
        <text x={OCF_X + OCF_W / 2} y={ocfTop - 22} textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="600" fontFamily="sans-serif">
          Operating Cash Flow
        </text>
        <text x={OCF_X + OCF_W / 2} y={ocfTop - 8} textAnchor="middle" fill={GOLD} fontSize="14" fontFamily="monospace" fontWeight="bold">
          {fmtLarge(ocf)}
        </text>
        {prev?.operatingCashFlow && (
          <text x={OCF_X + OCF_W / 2} y={BASE_Y + 14} textAnchor="middle" fill={GRAY} fontSize="9" fontFamily="sans-serif">
            {fmtYoY(ocf, Math.abs(prev.operatingCashFlow))}
          </text>
        )}

        {/* FCF Labels */}
        <text x={FCF_X + FCF_W / 2} y={fcfTop - 22} textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="600" fontFamily="sans-serif">
          Free Cash Flow
        </text>
        <text x={FCF_X + FCF_W / 2} y={fcfTop - 8} textAnchor="middle" fill={GOLD} fontSize="14" fontFamily="monospace" fontWeight="bold">
          {fmtLarge(fcf)}
        </text>

        {/* Buybacks label */}
        {buybackH > 4 && (
          <text x={RIGHT_X + RIGHT_W + 8} y={buybackTop + buybackH / 2 + 4} fill={BLUE_LIGHT} fontSize="10" fontFamily="sans-serif">
            Buybacks {fmtLarge(buybacks)}
          </text>
        )}

        {/* Retained label */}
        {retainedH > 4 && (
          <text x={RIGHT_X + RIGHT_W + 8} y={retainedTop + retainedH / 2 + 4} fill={GREEN_DARK} fontSize="10" fontFamily="sans-serif">
            Retained {fmtLarge(retained)}
          </text>
        )}

        {/* CapEx label */}
        <text x={(OCF_X + OCF_W + FCF_X) / 2} y={BASE_Y + 52} textAnchor="middle" fill="#b91c1c" fontSize="10" fontFamily="sans-serif">
          CapEx {fmtLarge(capex)}
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

CashFlowDiagram.displayName = 'CashFlowDiagram';
