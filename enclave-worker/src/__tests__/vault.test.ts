import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { analyzeMergedSeries } from '../analyzer.ts';
import { planVaultExecution } from '../vault.ts';
import type { ThesisResult } from '../types.ts';

const series = Array.from({ length: 10 }, (_, i) => ({
  date: `2025-03-${String(i + 1).padStart(2, '0')}`,
  price_usd: 5 + i * 0.1,
  defi_tvl_usd: 1e8 + i * 1e6,
}));
const factors = { github_commits_7d: 30, funding_rate_bps: 1, whale_net_flow_musd: 1 };

function base(): ThesisResult {
  return analyzeMergedSeries(series, { timeframe: '30d', target_token: 'NEAR' }, { factors });
}

afterEach(() => {
  delete process.env.VERITHESIS_VAULT_ENABLED;
  delete process.env.VERITHESIS_VAULT_NETWORK;
});

describe('planVaultExecution', () => {
  it('rejects a bullish signal that is not vault_eligible', () => {
    const r = base();
    r.conclusion.signal = 'bullish';
    r.vault_eligible = false;
    process.env.VERITHESIS_VAULT_ENABLED = '1';
    const plan = planVaultExecution(r, { official_signal: 'neutral', vault_trades_today: 0 });
    assert.equal(plan.status, 'rejected');
    assert.equal(plan.reason, 'dao_risk_vault_eligible');
  });

  it('plans only for eligible bullish results and validates the network env', () => {
    const r = base();
    r.conclusion.signal = 'bullish';
    r.vault_eligible = true;
    process.env.VERITHESIS_VAULT_ENABLED = '1';
    process.env.VERITHESIS_VAULT_NETWORK = 'evil-net';
    const plan = planVaultExecution(r, { official_signal: 'neutral', vault_trades_today: 0 });
    assert.equal(plan.status, 'planned');
    assert.equal(plan.network, 'near-testnet');
    process.env.VERITHESIS_VAULT_NETWORK = 'near-mainnet';
    assert.equal(
      planVaultExecution(r, { official_signal: 'neutral', vault_trades_today: 0 }).network,
      'near-mainnet',
    );
  });
});
