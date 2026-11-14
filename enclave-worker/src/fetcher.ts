import type { TargetToken, Timeframe } from './types';
import { coingeckoMarketChartUrlByDays, defiLlamaNearTvlUrl } from './data-sources';

export function timeframeToDays(tf: Timeframe): number {
  return tf === '7d' ? 7 : tf === '30d' ? 30 : 90;
}

interface DayPrice {
  date: string;
  price: number;
}

interface DayTvl {
  date: string;
  tvl: number;
}

/** DefiLlama v2 uses unix seconds; CoinGecko uses ms in market_chart. */
export function normalizeDayKey(raw: number | string): string {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) {
    return new Date(String(raw)).toISOString().slice(0, 10);
  }
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString().slice(0, 10);
}

export async function fetchPriceSeries(
  token: TargetToken,
  days: number,
): Promise<DayPrice[]> {
  const url = coingeckoMarketChartUrlByDays(token, days);
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { prices: [number, number][] };
  const map = new Map<string, number>();
  for (const [ts, price] of body.prices) {
    const date = normalizeDayKey(ts);
    map.set(date, price);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, price]) => ({ date, price }));
}

export async function fetchNearTvlSeries(days: number): Promise<DayTvl[]> {
  const url = defiLlamaNearTvlUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DefiLlama TVL ${res.status}`);
  }
  const rows = (await res.json()) as { date: number | string; tvl: number }[];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return rows
    .map((r) => ({
      date: normalizeDayKey(r.date),
      tvl: r.tvl,
    }))
    .filter((r) => r.date >= cutoffKey);
}

export function mergeSeries(prices: DayPrice[], tvls: DayTvl[]) {
  const tvlMap = new Map(tvls.map((t) => [t.date, t.tvl]));
  const merged: { date: string; price_usd: number; defi_tvl_usd: number }[] = [];
  for (const p of prices) {
    const tvl = tvlMap.get(p.date);
    if (tvl == null) continue;
    merged.push({
      date: p.date,
      price_usd: Math.round(p.price * 1e6) / 1e6,
      defi_tvl_usd: Math.round(tvl * 100) / 100,
    });
  }
  return merged;
}
