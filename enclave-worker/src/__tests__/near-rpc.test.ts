import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  fetchNearOnchainTelemetry,
  fetchNearOnchainTelemetrySafe,
  resetNearRpcCacheForTests,
  yoctoToMillionNear,
} from '../near-rpc.ts';

const realFetch = globalThis.fetch;
const savedRpc = process.env.NEAR_RPC_URL;

beforeEach(() => {
  resetNearRpcCacheForTests();
  delete process.env.NEAR_RPC_URL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedRpc === undefined) delete process.env.NEAR_RPC_URL;
  else process.env.NEAR_RPC_URL = savedRpc;
});

const SAMPLE_BLOCK = {
  jsonrpc: '2.0',
  result: {
    header: {
      height: 224_490_284,
      hash: 'EFYPEMxCsrk4SiVcCEXJM9Pgud5RC5BxtPF1Qbru8rC1',
      latest_protocol_version: 88,
      total_supply: '1311676510000000000000000000000000', // ~1311.7M NEAR
    },
  },
};

const SAMPLE_VALIDATORS = {
  jsonrpc: '2.0',
  result: {
    epoch_height: 4969,
    current_validators: [
      { account_id: 'figment.poolv1.near', stake: '300000000000000000000000000000000' }, // 300.0M NEAR
      { account_id: 'chorusone.poolv1.near', stake: '289075142000000000000000000000000' }, // 289.1M NEAR
    ],
  },
};

describe('yoctoToMillionNear', () => {
  it('converts 128-bit yoctoNEAR strings without floating-point precision loss', () => {
    assert.equal(yoctoToMillionNear('589075142000000000000000000000000'), 589.1);
    assert.equal(yoctoToMillionNear('1311676510000000000000000000000000'), 1311.7);
    assert.equal(yoctoToMillionNear('0'), 0);
  });

  it('rejects non-integer yoctoNEAR inputs', () => {
    assert.throws(() => yoctoToMillionNear('-1'), /Invalid yoctoNEAR/);
    assert.throws(() => yoctoToMillionNear('1.5e24'), /Invalid yoctoNEAR/);
  });
});

describe('fetchNearOnchainTelemetry', () => {
  it('computes block anchor, validator count and staking ratio from JSON-RPC', async () => {
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string };
      const payload = body.method === 'block' ? SAMPLE_BLOCK : SAMPLE_VALIDATORS;
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;

    const t = await fetchNearOnchainTelemetry();
    assert.equal(t.chain_id, 'mainnet');
    assert.equal(t.block_height, 224_490_284);
    assert.equal(t.protocol_version, 88);
    assert.equal(t.active_validators, 2);
    assert.equal(t.total_staked_mnear, 589.1);
    assert.equal(t.total_supply_mnear, 1311.7);
    assert.equal(t.staking_ratio_pct, 44.9);
  });

  it('fails over from primary RPC to fallback RPC when primary rate-limits (429)', async () => {
    const seen: string[] = [];
    globalThis.fetch = (async (url, init) => {
      const u = String(url);
      seen.push(u);
      if (u.includes('fastnear')) {
        return new Response('rate limit', { status: 429 });
      }
      const body = JSON.parse(String(init?.body)) as { method: string };
      const payload = body.method === 'block' ? SAMPLE_BLOCK : SAMPLE_VALIDATORS;
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;

    const t = await fetchNearOnchainTelemetry();
    assert.equal(t.rpc_endpoint, 'https://rpc.mainnet.near.org');
    assert.ok(seen.some((u) => u.includes('fastnear')));
    assert.ok(seen.some((u) => u.includes('rpc.mainnet.near.org')));
  });

  it('returns undefined in safe wrapper when all RPC providers fail', async () => {
    globalThis.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;
    assert.equal(await fetchNearOnchainTelemetrySafe(), undefined);
    await assert.rejects(fetchNearOnchainTelemetry(), /All NEAR RPC endpoints failed/);
  });
});
