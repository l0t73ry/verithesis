import {
  fetchNearTvlSeries,
  fetchPriceSeries,
  mergeSeries,
  timeframeToDays,
} from './fetcher';
import { analyzeMergedSeries } from './analyzer';
import { loadThesisFactors } from './factors';
import { runThesisInLocalTee, wasmArtifactAvailable } from './local-tee';
import { callOutLayerThesis, isOutLayerConfigured } from './outlayer-coordinator';
import type { ThesisInput, ThesisResult } from './types';

export { parseNaturalQuery } from './nlp';
export { analyzeMergedSeries, applyRealtimeLag } from './analyzer';
export {
  fetchNearTvlSeries,
  fetchPriceSeries,
  mergeSeries,
  timeframeToDays,
  normalizeDayKey,
} from './fetcher';
export {
  MARKET_DATA_SOURCES,
  coingeckoMarketChartUrlByDays,
  defiLlamaNearTvlUrl,
} from './data-sources';
export { hashThesisInput, hashOutput, sha256Hex, stableStringify } from './hash';
export { buildRunReceipt, type RunReceipt } from './receipt';
export { callOutLayerThesis, isOutLayerConfigured } from './outlayer-coordinator';
export { runThesisInLocalTee, wasmArtifactAvailable } from './local-tee';
export { loadThesisFactors, deriveSyntheticFactors, type ThesisFactors } from './factors';
export { planVaultExecution } from './vault';
export type { VaultExecutionPlan } from './vault';
export type {
  AttestationBundle,
  SeriesPoint,
  SnapshotRecord,
  StrategyMode,
  TargetToken,
  ThesisConclusion,
  ThesisInput,
  ThesisResult,
  Timeframe,
} from './types';

export async function runThesisAnalysis(
  input: ThesisInput,
  options?: { tee?: boolean },
): Promise<ThesisResult> {
  if (options?.tee) {
    if (isOutLayerConfigured()) {
      const remote = await callOutLayerThesis(input);
      if (remote) return remote;
      throw new Error('OutLayer returned no result');
    }
    if (wasmArtifactAvailable()) {
      return runThesisInLocalTee(input);
    }
    throw new Error(
      'Secure enclave requested: configure OutLayer (OUTLAYER_API_URL + OUTLAYER_PROJECT_ID) or build WASI (./outlayer/build-wasm.sh)',
    );
  }

  const days = timeframeToDays(input.timeframe);

  const [prices, tvls] = await Promise.all([
    fetchPriceSeries(input.target_token, days),
    fetchNearTvlSeries(days),
  ]);

  const series = mergeSeries(prices, tvls);
  if (series.length < 3) {
    throw new Error(
      `Insufficient overlapping price/TVL days (price=${prices.length}, tvl=${tvls.length}, merged=${series.length})`,
    );
  }

  const factors = await loadThesisFactors(series);
  return analyzeMergedSeries(series, input, { ...options, factors });
}
