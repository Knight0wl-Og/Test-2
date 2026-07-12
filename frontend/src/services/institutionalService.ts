import { Capacitor } from '@capacitor/core';
import { yahooCrumbGet } from './yahooCrumb';

export interface InstitutionalHolder {
  name: string;
  pctHeld: number;        // 0–100
  shares: number;
  value: number | null;
  reportDate: string;     // YYYY-MM-DD
  changeShares: number | null;
  changePct: number | null; // % change in position
}

export interface MajorHolders {
  insiderPct: number;
  institutionPct: number;
  holders: InstitutionalHolder[];
}

function getBackendBase(): string {
  return localStorage.getItem('TRADEEDGE_API_URL') || 'http://localhost:3001';
}

async function yfSummary(symbol: string, modules: string): Promise<unknown> {
  // quoteSummary requires Yahoo cookie+crumb auth
  if (Capacitor.isNativePlatform()) {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
    return yahooCrumbGet(url);
  }
  // Web/Electron: browser fetch can't carry the Yahoo cookie — proxy via backend
  const res = await fetch(
    `${getBackendBase()}/api/market/summary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules)}`
  );
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json();
}

export async function fetchInstitutionalHolders(symbol: string): Promise<MajorHolders> {
  const data = await yfSummary(symbol, 'institutionOwnership,majorHoldersBreakdown');
  const result = (data as any)?.quoteSummary?.result?.[0];

  const breakdown = result?.majorHoldersBreakdown ?? {};
  const insiderPct = ((breakdown.insidersPercentHeld?.raw ?? 0) * 100);
  const institutionPct = ((breakdown.institutionsPercentHeld?.raw ?? 0) * 100);

  const ownershipList: Record<string, unknown>[] =
    result?.institutionOwnership?.ownershipList ?? [];

  const holders: InstitutionalHolder[] = ownershipList.map((o) => {
    const reportTs: number | null = (o.reportDate as any)?.raw ?? null;
    return {
      name: (o.organization as string) ?? 'Unknown',
      pctHeld: ((o.pctHeld as any)?.raw ?? 0) * 100,
      shares: (o.shares as any)?.raw ?? 0,
      value: (o.value as any)?.raw ?? null,
      reportDate: reportTs ? new Date(reportTs * 1000).toISOString().slice(0, 10) : '',
      changeShares: (o.change as any)?.raw ?? null,
      changePct: null,
    };
  });

  // Compute changePct from changeShares / (shares - changeShares)
  holders.forEach((h) => {
    if (h.changeShares != null && h.shares > 0) {
      const prev = h.shares - h.changeShares;
      h.changePct = prev > 0 ? (h.changeShares / prev) * 100 : null;
    }
  });

  return { insiderPct, institutionPct, holders };
}
