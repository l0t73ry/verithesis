import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampSmoothingWindow, normalizeTvlWeight, parseThesisInput } from '../input.ts';

describe('parseThesisInput', () => {
  it('applies defaults', () => {
    assert.deepEqual(parseThesisInput({}), {
      timeframe: '30d',
      target_token: 'NEAR',
      smoothing_window: 1,
      tvl_weight: 0.5,
      strategy_mode: 'public',
    });
  });

  it('clamps and rounds numeric params', () => {
    const p = parseThesisInput({ smoothing_window: 99, tvl_weight: 0.12345 });
    assert.equal(p.smoothing_window, 14);
    assert.equal(p.tvl_weight, 0.2);
    assert.equal(parseThesisInput({ smoothing_window: '3.4' }).smoothing_window, 3);
  });

  it('rejects non-numeric / non-finite numbers instead of turning them into NaN', () => {
    assert.throws(() => parseThesisInput({ smoothing_window: 'abc' }), /smoothing_window/);
    assert.throws(() => parseThesisInput({ tvl_weight: 'NaN' }), /tvl_weight/);
    assert.throws(() => parseThesisInput({ tvl_weight: Infinity }), /tvl_weight/);
    assert.throws(() => parseThesisInput({ smoothing_window: {} }), /smoothing_window/);
  });

  it('rejects unknown enums', () => {
    assert.throws(() => parseThesisInput({ strategy_mode: 'yolo' }), /strategy_mode/);
    assert.throws(() => parseThesisInput({ timeframe: '1y' }), /timeframe/);
    assert.throws(() => parseThesisInput({ target_token: 'BTC' }), /target_token/);
  });

  it('rejects non-object bodies', () => {
    assert.throws(() => parseThesisInput(null), /JSON object/);
    assert.throws(() => parseThesisInput([]), /JSON object/);
    assert.throws(() => parseThesisInput('x'), /JSON object/);
  });

  it('never reads client-supplied unlock / receipt fields', () => {
    const p = parseThesisInput({ realtime_unlocked: true, payment_receipt: 'x' }) as Record<string, unknown>;
    assert.equal('realtime_unlocked' in p, false);
    assert.equal('payment_receipt' in p, false);
  });
});

describe('clamp helpers', () => {
  it('fall back safely on non-finite values', () => {
    assert.equal(clampSmoothingWindow(Number.NaN), 1);
    assert.equal(clampSmoothingWindow(undefined), 1);
    assert.equal(normalizeTvlWeight(Number.NaN), 0.5);
    assert.equal(normalizeTvlWeight(undefined), 0.5);
  });
});
