import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeMergedSeries } from '../analyzer.ts';
import { evaluateVaultDaoRisk, vaultRiskApproved } from '../vault-risk.ts';
import { planVaultExecution } from '../vault.ts';

const series = Array.from({ length: 10 }, (_, i) => ({
  date: `2025-03-${String(i + 1).padStart(2, '0')}`,
  price_usd: 5 + i * 0.1,
  defi_tvl_usd: 1e8 + i * 1e6,
}));
const factors = { github_commits_7d: 30, funding_rate_bps: 1, whale_net_flow_musd: 1 };

describe('evaluateVaultDaoRisk', () => {
  it('blocks vault when official signal missing (default require official)', () => {
    const r = analyzeMergedSeries(series, { timeframe: '30d', target_token: 'NEAR' }, { factors });
    r.conclusion.signal = 'bullish';
    r.vault_eligible = true;
    const gates = evaluateVaultDaoRisk(r, { official_signal: null, vault_trades_today: 0 });
    assert.equal(vaultRiskApproved(gates), false);
  });

  it('blocks vault when official signal is bearish', () => {
    const r = analyzeMergedSeries(series, { timeframe: '30d', target_token: 'NEAR' }, { factors });
    r.conclusion.signal = 'bullish';
    r.vault_eligible = true;
    const gates = evaluateVaultDaoRisk(r, { official_signal: 'bearish', vault_trades_today: 0 });
    assert.equal(vaultRiskApproved(gates), false);
    assert.equal(gates.find((g) => g.id === 'official_not_bearish')?.pass, false);
  });

  it('planVaultExecution returns dao_risk on planned path', () => {
    const r = analyzeMergedSeries(series, { timeframe: '30d', target_token: 'NEAR' }, { factors });
    r.conclusion.signal = 'bullish';
    r.vault_eligible = true;
    process.env.VERITHESIS_VAULT_ENABLED = '1';
    const plan = planVaultExecution(r, { official_signal: 'neutral', vault_trades_today: 0 });
    assert.ok(plan.dao_risk);
    assert.equal(plan.dao_risk.approved, true);
    delete process.env.VERITHESIS_VAULT_ENABLED;
  });
});