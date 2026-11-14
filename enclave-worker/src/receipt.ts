import type { AttestationBundle, ThesisConclusion, ThesisInput, ThesisResult } from './types';

export interface RunReceipt {
  schema: 'verithesis-run-receipt@v1';
  execution_timestamp: string;
  input_hash: string;
  output_hash: string;
  code_measurement: string;
  provider: AttestationBundle['provider'];
  quote_status: AttestationBundle['quote']['status'];
  input: Pick<
    ThesisInput,
    'timeframe' | 'target_token' | 'smoothing_window' | 'tvl_weight' | 'strategy_mode' | 'realtime_unlocked'
  >;
  conclusion: Pick<
    ThesisConclusion,
    'signal' | 'sharpe_ratio' | 'strategy_return_pct' | 'buy_hold_return_pct' | 'headline'
  >;
  snapshot_id?: string;
  /** Relative share path; host is deployment-specific. */
  verify_path: string;
}

export function buildRunReceipt(result: ThesisResult): RunReceipt {
  const { attestation, input, conclusion, snapshot } = result;
  return {
    schema: 'verithesis-run-receipt@v1',
    execution_timestamp: attestation.execution_timestamp,
    input_hash: attestation.input_hash,
    output_hash: attestation.output_hash,
    code_measurement: attestation.code_measurement,
    provider: attestation.provider,
    quote_status: attestation.quote.status,
    input: {
      timeframe: input.timeframe,
      target_token: input.target_token,
      smoothing_window: input.smoothing_window ?? 1,
      tvl_weight: input.tvl_weight ?? 0.5,
      strategy_mode: input.strategy_mode ?? 'public',
      realtime_unlocked: Boolean(input.realtime_unlocked),
    },
    conclusion: {
      signal: conclusion.signal,
      sharpe_ratio: conclusion.sharpe_ratio,
      strategy_return_pct: conclusion.strategy_return_pct,
      buy_hold_return_pct: conclusion.buy_hold_return_pct,
      headline: conclusion.headline,
    },
    snapshot_id: snapshot?.id,
    verify_path: `/?run=${attestation.output_hash}`,
  };
}
