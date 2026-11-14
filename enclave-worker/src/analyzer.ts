import { hashOutput, hashThesisInput } from './hash';
import { clampSmoothingWindow, normalizeTvlWeight } from './input';
import { backtestHitRate, pctChange, pearson } from './math';
import { backtestWeightedStrategy, buyAndHoldReturnPct } from './backtest';
import type { ThesisFactors } from './factors';
import type {
  AttestationBundle,
  SeriesPoint,
  StrategyMode,
  ThesisConclusion,
  ThesisInput,
  ThesisResult,
  SnapshotRecord,
} from './types';

const DEFAULT_CODE_MEASUREMENT =
  process.env.VERITHESIS_CODE_MEASUREMENT ?? 'git:verithesis-enclave-v0.3.0';

function smooth(values: number[], window: number): number[] {
  const w = clampSmoothingWindow(window);
  if (w <= 1) return values;
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - w + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function applySealedBias(r: number, mode: StrategyMode): number {
  if (mode !== 'sealed') return r;
  const bias = Number.parseFloat(process.env.VERITHESIS_SEALED_BIAS ?? '0.08');
  return Number.isFinite(bias) ? r + bias : r;
}

function weightedCompositeR(priceSm: number[], tvlSm: number[], tvlWeight: number): number {
  const wTvl = tvlWeight;
  const wMom = 1 - wTvl;
  const priceCh = pctChange(priceSm);
  const tvlCh = pctChange(tvlSm);
  const rTvl = pearson(priceCh, tvlCh);
  const rMom = priceCh.length > 2 ? pearson(priceCh.slice(1), priceCh.slice(0, -1)) : 0;
  return wTvl * rTvl + wMom * rMom;
}

function buildConclusion(
  series: SeriesPoint[],
  r: number,
  token: string,
  mode: StrategyMode,
  factors: ThesisFactors,
  tvlWeight: number,
): ThesisConclusion {
  const rAdj = applySealedBias(r, mode);
  const r2 = Math.round(rAdj * rAdj * 1000) / 1000;
  const hit = backtestHitRate(series);
  const bt = backtestWeightedStrategy(series, tvlWeight);
  const buyHold = buyAndHoldReturnPct(series);

  const priceCh = pctChange(series.map((s) => s.price_usd));
  // Newest-first summation order — identical to `rev().take(3).sum()` in main.rs (float parity).
  const recentMom = priceCh.slice(-3).reverse().reduce((a, b) => a + b, 0);

  let signal: ThesisConclusion['signal'] = 'neutral';
  if (rAdj > 0.25 && recentMom > 0) signal = 'bullish';
  else if (rAdj < -0.15 || recentMom < -0.05) signal = 'bearish';

  if (signal === 'bullish') {
    if (factors.github_commits_7d < 12) signal = 'neutral';
    if (factors.funding_rate_bps > 12) signal = 'neutral';
    if (factors.whale_net_flow_musd < -2) signal = 'neutral';
  }

  const modeNote = mode === 'sealed' ? ' (Sealed Alpha — weights in TEE only)' : '';

  const headline =
    signal === 'bullish'
      ? `${token} multi-factor edge: TVL/momentum + dev activity${modeNote}`
      : signal === 'bearish'
        ? `${token} diverges from NEAR DeFi TVL composite${modeNote}`
        : `${token} vs NEAR DeFi TVL: no strong edge in window${modeNote}`;

  const summary =
    `Pearson composite=${rAdj.toFixed(3)} (w_tvl=${tvlWeight}), R²=${r2.toFixed(3)}; ` +
    `Sharpe=${bt.sharpe.toFixed(2)}, MDD=${bt.maxDrawdownPct.toFixed(1)}%; ` +
    `strategy ${bt.totalReturnPct.toFixed(1)}% vs B&H ${buyHold.toFixed(1)}%; ` +
    `factors: gh7d=${factors.github_commits_7d}, funding=${factors.funding_rate_bps}bps, whale≈${factors.whale_net_flow_musd}M. ` +
    `Not financial advice.`;

  return {
    signal,
    pearson_r: Math.round(rAdj * 1000) / 1000,
    r_squared: r2,
    backtest_hit_rate: hit,
    tvl_weight: tvlWeight,
    github_commits_7d: factors.github_commits_7d,
    funding_rate_bps: factors.funding_rate_bps,
    whale_net_flow_musd: factors.whale_net_flow_musd,
    sharpe_ratio: bt.sharpe,
    max_drawdown_pct: bt.maxDrawdownPct,
    strategy_return_pct: bt.totalReturnPct,
    buy_hold_return_pct: buyHold,
    headline,
    summary,
  };
}

function buildAttestation(
  input: ThesisInput,
  partial: { series: SeriesPoint[]; conclusion: ThesisConclusion },
  codeMeasurement: string,
  tee: boolean,
  provider: AttestationBundle['provider'],
): AttestationBundle {
  const input_hash = hashThesisInput(input);
  const output_hash = hashOutput(partial);
  const execution_timestamp = new Date().toISOString();
  const simulated = !tee;

  return {
    provider,
    code_measurement: codeMeasurement,
    execution_timestamp,
    input_hash,
    output_hash,
    quote: {
      status: simulated ? 'simulated' : 'pending',
      verifier_hint: simulated
        ? 'This run’s hashes are fixed above. Re-run with the same settings to reproduce, or verify with an independent checker.'
        : 'Executed behind WASI module measurement (local wasmtime or OutLayer worker). Deploy to OutLayer for hardware TDX quote.',
    },
    signature_chain: [
      {
        role: 'Platform root',
        status: tee ? 'pending' : simulated ? 'mock' : 'pending',
        detail: tee ? 'WASI module measurement' : 'Bound to this deployment',
      },
      {
        role: 'Output binding',
        status: tee ? 'pass' : simulated ? 'mock' : 'pending',
        detail: `${output_hash.slice(0, 16)}…`,
      },
      {
        role: 'Input binding',
        status: 'pass',
        detail: `${codeMeasurement} · in=${input_hash.slice(0, 12)}…`,
      },
    ],
  };
}

export function applyRealtimeLag(series: SeriesPoint[], unlocked: boolean): {
  series: SeriesPoint[];
  lagged: boolean;
} {
  if (unlocked || series.length <= 1) {
    return { series, lagged: false };
  }
  return { series: series.slice(0, -1), lagged: true };
}

export function analyzeMergedSeries(
  series: SeriesPoint[],
  input: ThesisInput,
  options?: { tee?: boolean; factors?: ThesisFactors; provider?: AttestationBundle['provider'] },
): ThesisResult {
  const window = clampSmoothingWindow(input.smoothing_window);
  const mode: StrategyMode = input.strategy_mode ?? 'public';
  const code = input.code_measurement ?? DEFAULT_CODE_MEASUREMENT;
  const tvlWeight = normalizeTvlWeight(input.tvl_weight);
  const factors: ThesisFactors = options?.factors ?? {
    github_commits_7d: 0,
    funding_rate_bps: 0,
    whale_net_flow_musd: 0,
  };

  const priceSm = smooth(
    series.map((s) => s.price_usd),
    window,
  );
  const tvlSm = smooth(
    series.map((s) => s.defi_tvl_usd),
    window,
  );
  const r = weightedCompositeR(priceSm, tvlSm, tvlWeight);
  const conclusion = buildConclusion(series, r, input.target_token, mode, factors, tvlWeight);

  const unlocked = Boolean(input.realtime_unlocked);
  const { series: displaySeries, lagged } = applyRealtimeLag(series, unlocked);

  const partial = { series: displaySeries, conclusion };
  const tee = options?.tee ?? false;
  const provider = options?.provider ?? (tee ? 'outlayer-intel-tdx' : 'local-dev');
  const attestation = buildAttestation(input, partial, code, tee, provider);

  const snapshot: SnapshotRecord = {
    id: `${attestation.execution_timestamp}-${attestation.input_hash.slice(0, 8)}`,
    saved_at: attestation.execution_timestamp,
    input_hash: attestation.input_hash,
    output_hash: attestation.output_hash,
    signal: conclusion.signal,
    headline: conclusion.headline,
    timeframe: input.timeframe,
    target_token: input.target_token,
  };

  const data_sources = [
    `CoinGecko market_chart (${input.target_token})`,
    'DefiLlama historicalChainTvl/NEAR',
    'GitHub nearcore commits (7d, public API)',
    'Funding / whale flow: synthetic demo factors (TEE oracle in production)',
  ];

  const vault_eligible =
    conclusion.signal === 'bullish' &&
    conclusion.sharpe_ratio > 0 &&
    conclusion.strategy_return_pct > conclusion.buy_hold_return_pct;

  return {
    thesis_title: 'NEAR multi-factor verifiable thesis (re-run + backtest)',
    input: { ...input, smoothing_window: window, tvl_weight: tvlWeight },
    conclusion,
    series: displaySeries,
    series_lagged: lagged,
    attestation,
    data_sources,
    snapshot,
    strategy_mode: mode,
    vault_eligible,
  };
}
