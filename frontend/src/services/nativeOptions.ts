import { yahooCrumbGet } from './yahooCrumb';

export interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
  inTheMoney: boolean;
  expiration: string; // YYYY-MM-DD
  contractSymbol: string;
}

export interface OptionsChain {
  symbol: string;
  expirationDates: string[]; // UNIX timestamps as strings
  calls: OptionContract[];
  puts: OptionContract[];
  underlyingPrice: number;
}

function mapContract(raw: Record<string, unknown>, expDate: number): OptionContract {
  return {
    strike: (raw.strike as number) ?? 0,
    bid: (raw.bid as number) ?? 0,
    ask: (raw.ask as number) ?? 0,
    lastPrice: (raw.lastPrice as number) ?? 0,
    volume: (raw.volume as number | null) ?? null,
    openInterest: (raw.openInterest as number | null) ?? null,
    impliedVolatility: raw.impliedVolatility != null ? Number(((raw.impliedVolatility as number) * 100).toFixed(2)) : null,
    inTheMoney: (raw.inTheMoney as boolean) ?? false,
    expiration: new Date(expDate * 1000).toISOString().slice(0, 10),
    contractSymbol: (raw.contractSymbol as string) ?? '',
  };
}

export async function fetchOptionsNative(symbol: string, expirationDate?: number): Promise<OptionsChain> {
  // options endpoint requires Yahoo cookie+crumb auth (handled by yahooCrumbGet)
  let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
  if (expirationDate) url += `?date=${expirationDate}`;

  const data = await yahooCrumbGet(url);

  const result = (data as any)?.optionChain?.result?.[0];
  if (!result) throw new Error('No options data returned');

  const expDateTs: number = result.options?.[0]?.expirationDate ?? 0;
  const rawCalls: Record<string, unknown>[] = result.options?.[0]?.calls ?? [];
  const rawPuts: Record<string, unknown>[] = result.options?.[0]?.puts ?? [];

  return {
    symbol: symbol.toUpperCase(),
    expirationDates: (result.expirationDates ?? []).map(String),
    calls: rawCalls.map((c) => mapContract(c, expDateTs)),
    puts: rawPuts.map((p) => mapContract(p, expDateTs)),
    underlyingPrice: result.quote?.regularMarketPrice ?? 0,
  };
}
