import type { TargetToken } from './types';

/** Single source for market & on-chain data URLs (Node `fetcher.ts` + `near-rpc.ts`; port to WASI P2 HTTP next). */
export const MARKET_DATA_SOURCES = {
  coingecko: 'https://api.coingecko.com/api/v3',
  defiLlama: 'https://api.llama.fi',
  nearRpcPrimary: 'https://rpc.mainnet.fastnear.com',
  nearRpcFallback: 'https://rpc.mainnet.near.org',
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

/** Ordered NEAR Mainnet JSON-RPC providers (`docs.near.org/api/rpc/providers`). */
export function nearMainnetRpcUrls(): string[] {
  const custom = process.env.NEAR_RPC_URL?.trim();
  const defaults = [MARKET_DATA_SOURCES.nearRpcPrimary, MARKET_DATA_SOURCES.nearRpcFallback];
  return custom ? [custom, ...defaults.filter((u) => u !== custom)] : defaults;
}
