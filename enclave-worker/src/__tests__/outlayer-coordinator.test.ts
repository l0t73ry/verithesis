import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { analyzeMergedSeries } from '../analyzer.ts';
import { callOutLayerThesis } from '../outlayer-coordinator.ts';
import type { ThesisInput, ThesisResult } from '../types.ts';

const series = Array.from({ length: 10 }, (_, i) => ({
  date: `2025-03-${String(i + 1).padStart(2, '0')}`,
  price_usd: 5 + i * 0.1,
  defi_tvl_usd: 1e8 + i * 1e6,
}));
const factors = { github_commits_7d: 30, funding_rate_bps: 1, whale_net_flow_musd: 1 };
const input: ThesisInput = { timeframe: '30d', target_token: 'NEAR', smoothing_window: 1, tvl_weight: 0.5 };

const realFetch = globalThis.fetch;
const saved = { url: process.env.OUTLAYER_API_URL, project: process.env.OUTLAYER_PROJECT_ID };

function respondWith(body: unknown, status = 200) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}

beforeEach(() => {
  process.env.OUTLAYER_API_URL = 'http://coordinator.test';
  process.env.OUTLAYER_PROJECT_ID = 'demo.near/verithesis';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of [
    ['OUTLAYER_API_URL', saved.url],
    ['OUTLAYER_PROJECT_ID', saved.project],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function honest(): ThesisResult {
  return analyzeMergedSeries(series, input, { tee: true, factors });
}

describe('callOutLayerThesis', () => {
  it('never marks a quote as verified without a verifier', async () => {
    respondWith({ output: honest(), attestation: { tdx_quote_b64: 'bW9jaw==' } });
    const r = await callOutLayerThesis(input);
    assert.equal(r?.attestation.quote.status, 'pending');
    assert.equal(r?.attestation.quote.tdx_quote_b64, 'bW9jaw==');
    assert.match(r!.attestation.quote.verifier_hint, /NOT verified/);
    assert.equal(r?.attestation.signature_chain[0]?.status, 'pending');
  });

  it('rejects a path-traversal output_hash (it is later used as a file name)', async () => {
    const evil = honest();
    evil.attestation.output_hash = '../../../../tmp/pwned';
    respondWith({ output: evil });
    await assert.rejects(callOutLayerThesis(input), /malformed attestation hashes/);
  });

  it('rejects a result whose output_hash does not match its conclusion', async () => {
    const forged = honest();
    forged.conclusion = { ...forged.conclusion, signal: 'bullish', headline: 'forged' };
    respondWith({ output: forged });
    await assert.rejects(callOutLayerThesis(input), /output_hash does not match/);
  });

  it('rejects a result computed for a different input', async () => {
    const other = analyzeMergedSeries(series, { ...input, timeframe: '7d' }, { tee: true, factors });
    respondWith({ output: other });
    await assert.rejects(callOutLayerThesis(input), /input_hash does not match/);
  });

  it('truncates remote error text', async () => {
    respondWith({ error: 'x'.repeat(5000) }, 500);
    await assert.rejects(callOutLayerThesis(input), (e: Error) => e.message.length < 300);
  });
});
