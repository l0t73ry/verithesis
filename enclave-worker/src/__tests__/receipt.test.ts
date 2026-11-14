import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRunReceipt } from '../receipt';
import type { ThesisResult } from '../types';

const minimalResult = (): ThesisResult => ({
  thesis_title: 'test',
  input: {
    timeframe: '30d',
    target_token: 'NEAR',
    smoothing_window: 1,
    tvl_weight: 0.5,
    strategy_mode: 'public',
    realtime_unlocked: false,
  },
  strategy_mode: 'public',
  conclusion: {
    signal: 'bullish',
    pearson_r: 0.5,
    r_squared: 0.25,
    backtest_hit_rate: 0.6,
    tvl_weight: 0.5,
    github_commits_7d: 10,
    funding_rate_bps: 1,
    whale_net_flow_musd: 0,
    sharpe_ratio: 1.2,
    max_drawdown_pct: 5,
    strategy_return_pct: 10,
    buy_hold_return_pct: 8,
    headline: 'Test headline',
    summary: 'Test summary',
  },
  series: [{ date: '2024-01-01', price_usd: 1, defi_tvl_usd: 2 }],
  attestation: {
    provider: 'local-dev',
    code_measurement: 'abc',
    execution_timestamp: '2024-01-02T00:00:00.000Z',
    input_hash: 'a'.repeat(64),
    output_hash: 'b'.repeat(64),
    quote: { status: 'simulated', verifier_hint: 'dev' },
    signature_chain: [],
  },
  data_sources: [],
  snapshot: {
    id: '2024-input',
    saved_at: '2024-01-02T00:00:00.000Z',
    input_hash: 'a'.repeat(64),
    output_hash: 'b'.repeat(64),
    signal: 'bullish',
    headline: 'Test headline',
    timeframe: '30d',
    target_token: 'NEAR',
  },
});

test('buildRunReceipt', () => {
  const r = buildRunReceipt(minimalResult());
  assert.equal(r.schema, 'verithesis-run-receipt@v1');
  assert.equal(r.output_hash, 'b'.repeat(64));
  assert.equal(r.verify_path, `/?run=${'b'.repeat(64)}`);
  assert.equal(r.snapshot_id, '2024-input');
  assert.equal(r.near_onchain, undefined);
});

test('buildRunReceipt includes near_onchain anchor when present', () => {
  const withChain = minimalResult();
  withChain.near_onchain = {
    rpc_endpoint: 'https://rpc.mainnet.fastnear.com',
    chain_id: 'mainnet',
    block_height: 224_490_284,
    block_hash: 'EFYPEMxCsrk4SiVcCEXJM9Pgud5RC5BxtPF1Qbru8rC1',
    protocol_version: 88,
    active_validators: 345,
    total_staked_mnear: 589.1,
    total_supply_mnear: 1311.7,
    staking_ratio_pct: 44.9,
  };
  const r = buildRunReceipt(withChain);
  assert.deepEqual(r.near_onchain, {
    block_height: 224_490_284,
    block_hash: 'EFYPEMxCsrk4SiVcCEXJM9Pgud5RC5BxtPF1Qbru8rC1',
    active_validators: 345,
    total_staked_mnear: 589.1,
    staking_ratio_pct: 44.9,
  });
});
