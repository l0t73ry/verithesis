import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashOutput, hashThesisInput, sha256Hex, stableStringify } from '../hash.ts';
import type { ThesisInput } from '../types.ts';

describe('stableStringify', () => {
  it('sorts object keys deterministically', () => {
    const a = stableStringify({ z: 1, a: 2, m: 3 });
    const b = stableStringify({ m: 3, a: 2, z: 1 });
    assert.equal(a, b);
  });

  it('nested objects are stable', () => {
    const payload = { b: { y: 1, x: 2 }, a: 1 };
    assert.equal(stableStringify(payload), '{"a":1,"b":{"x":2,"y":1}}');
  });
});

describe('hashThesisInput', () => {
  const base: ThesisInput = {
    timeframe: '30d',
    target_token: 'NEAR',
    smoothing_window: 1,
    strategy_mode: 'public',
    realtime_unlocked: false,
    tvl_weight: 0.5,
  };

  it('is stable for identical input', () => {
    assert.equal(hashThesisInput(base), hashThesisInput({ ...base }));
  });

  it('rounds tvl_weight to 3 decimals', () => {
    const a = hashThesisInput({ ...base, tvl_weight: 0.5004 });
    const b = hashThesisInput({ ...base, tvl_weight: 0.50049 });
    assert.equal(a, b);
    const c = hashThesisInput({ ...base, tvl_weight: 0.501 });
    assert.notEqual(a, c);
  });

  it('changes when timeframe changes', () => {
    const a = hashThesisInput(base);
    const b = hashThesisInput({ ...base, timeframe: '7d' });
    assert.notEqual(a, b);
  });
});

describe('hashOutput', () => {
  it('binds conclusion and series', () => {
    const conclusion = { signal: 'neutral' as const, pearson_r: 0.1 };
    const series = [{ date: '2025-01-01', price_usd: 1, defi_tvl_usd: 2 }];
    const h1 = hashOutput({ conclusion, series });
    const h2 = hashOutput({ conclusion, series: [...series, { date: '2025-01-02', price_usd: 1.1, defi_tvl_usd: 2.1 }] });
    assert.notEqual(h1, h2);
    assert.equal(h1.length, 64);
    assert.match(h1, /^[a-f0-9]+$/);
  });
});

describe('sha256Hex', () => {
  it('matches known digests', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex('test'), '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  });
});
