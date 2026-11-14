import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { isPaymentReceiptValid } from '../payment.ts';

afterEach(() => {
  delete process.env.VERITHESIS_DISABLE_DEMO_PAYMENT;
});

describe('isPaymentReceiptValid (demo)', () => {
  it('accepts only the demo receipt format', () => {
    assert.equal(isPaymentReceiptValid('demo-near-0.1'), true);
    for (const bad of ['', 'x', 'anything', 'demo-near-', 'demo-near-1;rm', null, undefined, true, 1]) {
      assert.equal(isPaymentReceiptValid(bad), false, String(bad));
    }
  });

  it('can be switched off entirely', () => {
    process.env.VERITHESIS_DISABLE_DEMO_PAYMENT = '1';
    assert.equal(isPaymentReceiptValid('demo-near-0.1'), false);
  });
});
