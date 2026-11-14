import type { TargetToken, Timeframe } from './types';
import { coingeckoMarketChartUrlByDays, defiLlamaNearTvlUrl } from './data-sources';
import { fetchWithTimeout } from './http';

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
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(raw));
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date value: ${String(raw)}`);
  return d.toISOString().slice(0, 10);
}

/** Like `normalizeDayKey` but returns null for unparseable input (upstream rows are untrusted). */
function tryDayKey(raw: number | string): string | null {
  try {
    return normalizeDayKey(raw);
  } catch {
    return null;
  }
}

export async function fetchPriceSeries(
  token: TargetToken,
  days: number,
): Promise<DayPrice[]> {
  const url = coingeckoMarketChartUrlByDays(token, days);
  const res = await fetchWithTimeout(url, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    // Do not echo the upstream body back to API clients.
    throw new Error(`CoinGecko request failed (${res.status})`);
  }
  const body = (await res.json()) as { prices?: [number, number][] };
  if (!Array.isArray(body.prices)) throw new Error('CoinGecko response missing prices');
  const map = new Map<string, number>();
  for (const [ts, price] of body.prices) {
    const date = tryDayKey(ts);
    if (!date || !Number.isFinite(price)) continue;
    map.set(date, price);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, price]) => ({ date, price }));
}

export async function fetchNearTvlSeries(days: number): Promise<DayTvl[]> {
  const url = defiLlamaNearTvlUrl();
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`DefiLlama TVL request failed (${res.status})`);
  }
  const rows = (await res.json()) as { date: number | string; tvl: number }[];
  if (!Array.isArray(rows)) throw new Error('DefiLlama response is not an array');
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const out: DayTvl[] = [];
  for (const r of rows) {
    const date = tryDayKey(r.date);
    if (!date || !Number.isFinite(r.tvl) || date < cutoffKey) continue;
    out.push({ date, tvl: r.tvl });
  }
  return out;
}

/** Keeps only days with a positive price and a finite TVL so downstream math never sees NaN/÷0. */
export function mergeSeries(prices: DayPrice[], tvls: DayTvl[]) {
  const tvlMap = new Map(tvls.map((t) => [t.date, t.tvl]));
  const merged: { date: string; price_usd: number; defi_tvl_usd: number }[] = [];
  for (const p of prices) {
    const tvl = tvlMap.get(p.date);
    if (tvl == null || !Number.isFinite(tvl) || !(p.price > 0)) continue;
    merged.push({
      date: p.date,
      price_usd: Math.round(p.price * 1e6) / 1e6,
      defi_tvl_usd: Math.round(tvl * 100) / 100,
    });
  }
  return merged;
}
