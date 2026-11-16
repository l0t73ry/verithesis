import type { ThesisConclusion, ThesisInput, ThesisResult, Timeframe, TargetToken } from '@verithesis/enclave-worker';
import { signalExplainKeys, formatRecentMomPct } from '@/lib/signal-explainer';

export type SuggestedAction = 'hold' | 'watch_long_bias' | 'defensive';

export function officialThesisInput(): ThesisInput {
  const timeframe = (process.env.VERITHESIS_OFFICIAL_TIMEFRAME || '90d') as Timeframe;
  const target_token = (process.env.VERITHESIS_OFFICIAL_TOKEN || 'NEAR') as TargetToken;
  const tvl = Number(process.env.VERITHESIS_OFFICIAL_TVL_WEIGHT ?? '0.5');
  return {
    timeframe,
    target_token,
    smoothing_window: 1,
    tvl_weight: Number.isFinite(tvl) ? tvl : 0.5,
    strategy_mode: 'public',
  };
}

export function suggestedActionFromSignal(signal: ThesisConclusion['signal']): SuggestedAction {
  if (signal === 'bullish') return 'watch_long_bias';
  if (signal === 'bearish') return 'defensive';
  return 'hold';
}

export function buildOfficialSignalView(result: ThesisResult) {
  const c = result.conclusion;
  const triggers = signalExplainKeys(c, result.series, result.strategy_mode);
  return {
    strategy_id: 'tvl-mom-v1',
    suggested_action: suggestedActionFromSignal(c.signal),
    signal: c.signal,
    pearson_r: c.pearson_r,
    recent_mom_pct: formatRecentMomPct(result.series),
    triggers,
    buy_hold_return_pct: c.buy_hold_return_pct,
    strategy_return_pct: c.strategy_return_pct,
    input_hash: result.attestation.input_hash,
    output_hash: result.attestation.output_hash,
    data_snapshot_id: result.input.data_snapshot_id ?? result.hub_snapshot?.id,
    hub_snapshot_fetched_at: result.hub_snapshot?.fetched_at ?? null,
    input: result.input,
  };
}