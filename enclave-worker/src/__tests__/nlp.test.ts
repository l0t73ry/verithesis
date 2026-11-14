import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNaturalQuery } from '../nlp.ts';

describe('parseNaturalQuery', () => {
  it('parses timeframe and token', () => {
    assert.deepEqual(parseNaturalQuery('NEAR 30d'), {
      target_token: 'NEAR',
      timeframe: '30d',
    });
  });

  it('parses smoothing window', () => {
    assert.deepEqual(parseNaturalQuery('平滑 7'), { smoothing_window: 7 });
  });

  it('parses tvl weight percent', () => {
    assert.deepEqual(parseNaturalQuery('TVL 权重 60%'), { tvl_weight: 0.6 });
  });

  it('clamps tvl weight to 20–80%', () => {
    assert.deepEqual(parseNaturalQuery('权重 5%'), { tvl_weight: 0.2 });
    assert.deepEqual(parseNaturalQuery('tvl 99'), { tvl_weight: 0.8 });
  });

  it('parses sealed mode', () => {
    assert.deepEqual(parseNaturalQuery('sealed alpha NEAR'), {
      target_token: 'NEAR',
      strategy_mode: 'sealed',
    });
  });

  it('returns empty for unrelated text', () => {
    assert.deepEqual(parseNaturalQuery('what is the meaning of life'), {});
  });
});
