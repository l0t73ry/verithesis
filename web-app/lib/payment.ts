/**
 * Realtime-unlock payment check.
 *
 * DEMO ONLY: the paywall is a hackathon stub. A receipt of the form `demo-near-<amount>` unlocks
 * realtime data; there is no on-chain verification and no replay protection. The client-supplied
 * `realtime_unlocked` flag is never trusted. Replace `isPaymentReceiptValid` with a NEAR RPC
 * lookup (receiver, amount, memo = input_hash, one-time use) before charging real money, and set
 * `VERITHESIS_DISABLE_DEMO_PAYMENT=1` in any deployment that must not offer the demo unlock.
 */
const DEMO_RECEIPT_RE = /^demo-near-\d{1,3}(\.\d{1,4})?$/;

export function isPaymentReceiptValid(receipt: unknown): receipt is string {
  if (process.env.VERITHESIS_DISABLE_DEMO_PAYMENT === '1') return false;
  return typeof receipt === 'string' && DEMO_RECEIPT_RE.test(receipt);
}
