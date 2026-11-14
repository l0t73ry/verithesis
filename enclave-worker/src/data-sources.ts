import type { TargetToken } from './types';

/** Single source for market data URLs (Node `fetcher.ts` today; port to WASI P2 HTTP next). */
export const MARKET_DATA_SOURCES = {
  coingecko: 'https://api.coingecko.com/api/v3',
  defiLlama: 'https://api.llama.fi',
} as const;

const COINGECKO_IDS: Record<TargetToken, string> = {
  NEAR: 'near',
  REF: 'ref-finance',
};

export function coingeckoMarketChartUrlByDays(token: TargetToken, days: number): string {
  const id = COINGECKO_IDS[token];
  return `${MARKET_DATA_SOURCES.coingecko}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
}

export function defiLlamaNearTvlUrl(): string {
  return `${MARKET_DATA_SOURCES.defiLlama}/v2/historicalChainTvl/NEAR`;
}
