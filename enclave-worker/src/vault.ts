import type { ThesisResult } from './types';

export type VaultExecutionPlan = {
  status: 'planned' | 'disabled' | 'rejected';
  reason?: string;
  network: 'near-testnet' | 'near-mainnet';
  dex: 'ref-finance';
  action: 'swap';
  from_token: string;
  to_token: string;
  amount_near: string;
  policy: { max_per_trade_near: string; max_trades_per_day: number };
  attestation_input_hash: string;
};

const MAX_TRADE = process.env.VERITHESIS_VAULT_MAX_NEAR ?? '0.1';
const NETWORKS = ['near-testnet', 'near-mainnet'] as const;

function vaultNetwork(): VaultExecutionPlan['network'] {
  const n = process.env.VERITHESIS_VAULT_NETWORK;
  return (NETWORKS as readonly string[]).includes(n ?? '') ? (n as VaultExecutionPlan['network']) : 'near-testnet';
}

/** Placeholder for OutLayer TEE wallet — returns an auditable plan, not a live tx. */
export function planVaultExecution(result: ThesisResult): VaultExecutionPlan {
  if (result.conclusion.signal !== 'bullish' || !result.vault_eligible) {
    return {
      status: 'rejected',
      reason: result.conclusion.signal !== 'bullish' ? 'signal_not_bullish' : 'not_vault_eligible',
      network: 'near-testnet',
      dex: 'ref-finance',
      action: 'swap',
      from_token: 'NEAR',
      to_token: result.input.target_token,
      amount_near: '0',
      policy: { max_per_trade_near: MAX_TRADE, max_trades_per_day: 1 },
      attestation_input_hash: result.attestation.input_hash,
    };
  }
  if (!process.env.VERITHESIS_VAULT_ENABLED) {
    return {
      status: 'disabled',
      reason: 'VERITHESIS_VAULT_ENABLED not set',
      network: 'near-testnet',
      dex: 'ref-finance',
      action: 'swap',
      from_token: 'NEAR',
      to_token: result.input.target_token,
      amount_near: MAX_TRADE,
      policy: { max_per_trade_near: MAX_TRADE, max_trades_per_day: 1 },
      attestation_input_hash: result.attestation.input_hash,
    };
  }
  return {
    status: 'planned',
    network: vaultNetwork(),
    dex: 'ref-finance',
    action: 'swap',
    from_token: 'NEAR',
    to_token: result.input.target_token,
    amount_near: MAX_TRADE,
    policy: { max_per_trade_near: MAX_TRADE, max_trades_per_day: 1 },
    attestation_input_hash: result.attestation.input_hash,
  };
}
