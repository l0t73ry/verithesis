import { fetchWithTimeout } from './http';

const BINANCE_NEAR_PERP = 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=NEARUSDT';
const FUNDING_CACHE_TTL_MS = 5 * 60 * 1000;
let fundingCache: { value: number; at: number } | null = null;

export function resetFundingCacheForTests() {
  fundingCache = null;
}

/** Binance USDT-M NEAR perpetual last funding rate → bps (0.01% = 1 bps). */
export async function fetchNearPerpFundingBps(): Promise<number> {
  const now = Date.now();
  if (fundingCache && now - fundingCache.at < FUNDING_CACHE_TTL_MS) return fundingCache.value;

  const res = await fetchWithTimeout(BINANCE_NEAR_PERP);
  if (!res.ok) throw new Error(`Binance funding unavailable (${res.status})`);
  const body = (await res.json()) as { lastFundingRate?: string };
  const rate = Number(body.lastFundingRate);
  if (!Number.isFinite(rate)) throw new Error('Binance funding parse failed');

  const bps = Math.round(rate * 10000 * 10) / 10;
  fundingCache = { value: bps, at: now };
  return bps;
}

/** NEAR DeFi TVL net change over the last 7 calendar days (millions USD, DefiLlama-aligned). */
export function computeTvlNetFlow7dMusd(tvlRows: { date: string; tvl: number }[]): number {
  if (tvlRows.length < 2) return 0;
  const sorted = [...tvlRows].sort((a, b) => a.date.localeCompare(b.date));
  const end = sorted[sorted.length - 1]!;
  const cutoff = new Date(`${end.date}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const start = sorted.find((r) => r.date >= cutoffKey) ?? sorted[0]!;
  if (!start || start.date === end.date) return 0;
  return Math.round(((end.tvl - start.tvl) / 1e6) * 10) / 10;
}