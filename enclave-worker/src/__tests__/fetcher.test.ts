import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeSeries, normalizeDayKey } from '../fetcher.ts';
import { deriveSyntheticFactors } from '../factors.ts';

describe('mergeSeries', () => {
  it('drops days with zero/negative prices and non-finite TVL', () => {
    const merged = mergeSeries(
      [
        { date: '2025-01-01', price: 0 },
        { date: '2025-01-02', price: 5 },
        { date: '2025-01-03', price: 6 },
        { date: '2025-01-04', price: -1 },
      ],
      [
        { date: '2025-01-01', tvl: 1 },
        { date: '2025-01-02', tvl: Number.NaN },
        { date: '2025-01-03', tvl: 2 },
        { date: '2025-01-04', tvl: 3 },
      ],
    );
    assert.deepEqual(merged, [{ date: '2025-01-03', price_usd: 6, defi_tvl_usd: 2 }]);
  });
});

describe('normalizeDayKey', () => {
  it('handles seconds, milliseconds and rejects garbage with a clear error', () => {
    assert.equal(normalizeDayKey(1735689600), '2025-01-01');
    assert.equal(normalizeDayKey(1735689600000), '2025-01-01');
    assert.throws(() => normalizeDayKey('not-a-date'), /Invalid date/);
  });
});

describe('deriveSyntheticFactors', () => {
  it('stays finite even when a price is zero', () => {
    const f = deriveSyntheticFactors([
      { date: 'a', price_usd: 0, defi_tvl_usd: 1e6 },
      { date: 'b', price_usd: 1, defi_tvl_usd: 2e6 },
      { date: 'c', price_usd: 2, defi_tvl_usd: 3e6 },
    ]);
    assert.ok(Number.isFinite(f.funding_rate_bps));
    assert.ok(Number.isFinite(f.whale_net_flow_musd));
  });
});
