interface StatCardProps {
  label: string;
  value: string;
  yoy?: string | null;
  margin?: string | null;
}

function StatCard({ label, value, yoy, margin }: StatCardProps) {
  const yoyUp = yoy?.startsWith('+');
  return (
    <div className="bg-bg-panel border border-[#1e2448] rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-amber-400 font-mono leading-tight">{value}</p>
      {(yoy || margin) && (
        <div className="flex items-center gap-2 mt-1">
          {yoy && (
            <span className={`text-[11px] font-semibold ${yoyUp ? 'text-green-400' : 'text-red-400'}`}>
              {yoy} Y/Y
            </span>
          )}
          {margin && (
            <span className="text-[11px] text-gray-500">Margin: {margin}</span>
          )}
        </div>
      )}
    </div>
  );
}

function fmtLarge(n: number | null): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}

function fmtYoY(curr: number | null, prev: number | null): string | null {
  if (curr == null || prev == null || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
}

function fmtPct(num: number | null, den: number | null): string | null {
  if (num == null || den == null || den === 0) return null;
  return ((num / den) * 100).toFixed(1) + '%';
}

export interface IncomeStatRow {
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  epsDiluted: number;
}

interface Props {
  current: IncomeStatRow;
  previous: IncomeStatRow | null;
}

export function EarningsStatCards({ current, previous }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto py-1">
      <StatCard
        label="Revenue"
        value={fmtLarge(current.revenue)}
        yoy={fmtYoY(current.revenue, previous?.revenue ?? null)}
      />
      <StatCard
        label="Gross Profit"
        value={fmtLarge(current.grossProfit)}
        margin={fmtPct(current.grossProfit, current.revenue)}
      />
      <StatCard
        label="Operating Income"
        value={fmtLarge(current.operatingIncome)}
        yoy={fmtYoY(current.operatingIncome, previous?.operatingIncome ?? null)}
        margin={fmtPct(current.operatingIncome, current.revenue)}
      />
      <StatCard
        label="Net Income"
        value={fmtLarge(current.netIncome)}
        yoy={fmtYoY(current.netIncome, previous?.netIncome ?? null)}
        margin={fmtPct(current.netIncome, current.revenue)}
      />
      <StatCard
        label="EPS"
        value={current.epsDiluted != null ? `$${current.epsDiluted.toFixed(2)}` : '—'}
        yoy={fmtYoY(current.epsDiluted, previous?.epsDiluted ?? null)}
      />
    </div>
  );
}
