import type { ThesisConclusion, ThesisResult } from './types';

export type VaultRiskGateId =
  | 'vault_eligible'
  | 'signal_bullish'
  | 'official_not_bearish'
  | 'max_drawdown'
  | 'min_sharpe'
  | 'daily_trade_cap';

export type VaultRiskGate = {
  id: VaultRiskGateId;
  pass: boolean;
  detail: string;
};

export type VaultRiskContext = {
  official_signal?: ThesisConclusion['signal'] | null;
  vault_trades_today?: number;
};

function envNum(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
}

/** DAO-style policy gates before any TEE vault plan is emitted. */
export function evaluateVaultDaoRisk(result: ThesisResult, ctx: VaultRiskContext = {}): VaultRiskGate[] {
  const c = result.conclusion;
  const maxMdd = envNum('VERITHESIS_VAULT_MAX_MDD_PCT', 35);
  const minSharpe = envNum('VERITHESIS_VAULT_MIN_SHARPE', 0);
  const maxTrades = Math.max(1, Math.floor(envNum('VERITHESIS_VAULT_MAX_TRADES_PER_DAY', 1)));
  const tradesToday = Math.max(0, ctx.vault_trades_today ?? 0);
  const official = ctx.official_signal ?? null;

  const gates: VaultRiskGate[] = [
    {
      id: 'vault_eligible',
      pass: Boolean(result.vault_eligible),
      detail: result.vault_eligible
        ? 'strategy beats B&H with positive Sharpe'
        : 'vault_eligible false (signal/backtest gate)',
    },
    {
      id: 'signal_bullish',
      pass: c.signal === 'bullish',
      detail: `run signal=${c.signal}`,
    },
    {
      id: 'official_not_bearish',
      pass: official == null || official !== 'bearish',
      detail: official == null ? 'no official signal in context' : `official=${official}`,
    },
    {
      id: 'max_drawdown',
      pass: c.max_drawdown_pct <= maxMdd,
      detail: `mdd=${c.max_drawdown_pct.toFixed(2)}% limit ${maxMdd}%`,
    },
    {
      id: 'min_sharpe',
      pass: c.sharpe_ratio > minSharpe,
      detail: `sharpe=${c.sharpe_ratio.toFixed(3)} min ${minSharpe}`,
    },
    {
      id: 'daily_trade_cap',
      pass: tradesToday < maxTrades,
      detail: `trades_today=${tradesToday} cap=${maxTrades}`,
    },
  ];

  return gates;
}

export function vaultRiskApproved(gates: VaultRiskGate[]): boolean {
  return gates.every((g) => g.pass);
}