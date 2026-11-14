import { nearMainnetRpcUrls } from './data-sources';
import { fetchWithTimeout } from './http';
import type { NearOnchainTelemetry } from './types';

const NEAR_RPC_TIMEOUT_MS = 6_000;
const NEAR_RPC_CACHE_TTL_MS = 60_000;

/** 10^27 yoctoNEAR = 0.001 Million NEAR; keeps u128 yoctoNEAR conversion exact via BigInt. */
const YOCTO_PER_MILLI_MNEAR = BigInt('1000000000000000000000000000');
const ZERO = BigInt(0);
const PER_MILLE = BigInt(1000);

let nearCache: { value: NearOnchainTelemetry; at: number } | null = null;

export function resetNearRpcCacheForTests() {
  nearCache = null;
}

/**
 * Convert a u128 yoctoNEAR string (`10^24` yocto = 1 NEAR) into millions of NEAR using BigInt
 * so 33-digit integers never lose precision before rounding.
 */
export function yoctoToMillionNear(yocto: string): number {
  const clean = yocto.trim();
  if (!/^\d+$/.test(clean)) throw new Error(`Invalid yoctoNEAR integer: ${yocto}`);
  const milliMnear = Number(BigInt(clean) / YOCTO_PER_MILLI_MNEAR);
  return Math.round(milliMnear / 100) / 10;
}

type JsonRpcEnvelope<T> = {
  result?: T;
  error?: { message?: string; data?: unknown };
};

type NearBlockResult = {
  header?: {
    height?: number;
    hash?: string;
    latest_protocol_version?: number;
    total_supply?: string;
  };
};

type NearValidatorsResult = {
  epoch_height?: number;
  current_validators?: Array<{ account_id?: string; stake?: string }>;
};

async function callNearRpc<T>(endpoint: string, method: string, params: unknown): Promise<T> {
  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'verithesis', method, params }),
    },
    NEAR_RPC_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`NEAR RPC ${method} HTTP ${res.status}`);
  const body = (await res.json()) as JsonRpcEnvelope<T>;
  if (body.error || !body.result) {
    throw new Error(`NEAR RPC ${method} error: ${body.error?.message ?? 'missing result'}`);
  }
  return body.result;
}

async function queryEndpoint(endpoint: string): Promise<NearOnchainTelemetry> {
  const [block, validators] = await Promise.all([
    callNearRpc<NearBlockResult>(endpoint, 'block', { finality: 'final' }),
    callNearRpc<NearValidatorsResult>(endpoint, 'validators', [null]),
  ]);

  const header = block.header;
  const height = header?.height;
  const hash = header?.hash;
  const protocolVersion = header?.latest_protocol_version;
  const totalSupplyRaw = header?.total_supply;
  const currentValidators = validators.current_validators;

  if (
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    typeof hash !== 'string' ||
    !hash ||
    typeof protocolVersion !== 'number' ||
    typeof totalSupplyRaw !== 'string' ||
    !Array.isArray(currentValidators) ||
    currentValidators.length === 0
  ) {
    throw new Error('Malformed NEAR RPC block/validators payload');
  }

  let totalStakedYocto = ZERO;
  for (const v of currentValidators) {
    if (typeof v.stake === 'string' && /^\d+$/.test(v.stake)) {
      totalStakedYocto += BigInt(v.stake);
    }
  }
  const totalSupplyYocto = BigInt(totalSupplyRaw);
  if (totalSupplyYocto <= ZERO) throw new Error('NEAR total_supply must be positive');

  // Basis-points math in BigInt (`* 1000 / supply` -> tenths of a percent) avoids float drift.
  const stakingRatioTenths = Number((totalStakedYocto * PER_MILLE) / totalSupplyYocto);

  return {
    rpc_endpoint: endpoint,
    chain_id: 'mainnet',
    block_height: height,
    block_hash: hash,
    protocol_version: protocolVersion,
    epoch_height: typeof validators.epoch_height === 'number' ? validators.epoch_height : undefined,
    active_validators: currentValidators.length,
    total_staked_mnear: yoctoToMillionNear(totalStakedYocto.toString()),
    total_supply_mnear: yoctoToMillionNear(totalSupplyRaw),
    staking_ratio_pct: stakingRatioTenths / 10,
  };
}

/**
 * Queries NEAR Mainnet JSON-RPC (`block` + `validators`, see `docs.near.org/api/rpc/protocol` and
 * `docs.near.org/api/rpc/validators`) across ordered providers with a 60s in-memory cache.
 */
export async function fetchNearOnchainTelemetry(): Promise<NearOnchainTelemetry> {
  const now = Date.now();
  if (nearCache && now - nearCache.at < NEAR_RPC_CACHE_TTL_MS) return nearCache.value;

  const endpoints = nearMainnetRpcUrls();
  const errors: string[] = [];
  for (const endpoint of endpoints) {
    try {
      const telemetry = await queryEndpoint(endpoint);
      nearCache = { value: telemetry, at: now };
      return telemetry;
    } catch (e) {
      errors.push(`${endpoint}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (nearCache) return nearCache.value;
  throw new Error(`All NEAR RPC endpoints failed (${errors.join('; ')})`);
}

/** Best-effort wrapper so transient L1 RPC outages never take down the deterministic series/hash pipeline. */
export async function fetchNearOnchainTelemetrySafe(): Promise<NearOnchainTelemetry | undefined> {
  try {
    return await fetchNearOnchainTelemetry();
  } catch {
    return undefined;
  }
}
