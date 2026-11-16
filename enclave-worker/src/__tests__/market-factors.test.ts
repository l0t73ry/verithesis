import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { computeTvlNetFlow7dMusd, fetchNearPerpFundingBps, resetFundingCacheForTests } from '../market-factors.ts';

const realFetch = globalThis.fetch;

function mockFetch(impl: () => Response | Promise<Response>) {
  globalThis.fetch = (async () => impl()) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  resetFundingCacheForTests();
});

describe('computeTvlNetFlow7dMusd', () => {
  it('uses last 7 days TVL delta in millions', () => {
    const rows = [
      { date: '2026-11-09', tvl: 200_000_000 },
      { date: '2026-11-12', tvl: 180_000_000 },
      { date: '2026-11-16', tvl: 149_000_000 },
    ];
    const v = computeTvlNetFlow7dMusd(rows);
    assert.equal(v, -51);
  });
});

describe('fetchNearPerpFundingBps', () => {
  it('parses Binance lastFundingRate to bps', async () => {
    mockFetch(() => new Response(JSON.stringify({ lastFundingRate: '0.0001' }), { status: 200 }));
    assert.equal(await fetchNearPerpFundingBps(), 1);
  });
});