import {
  fetchNearTvlSeries,
  fetchPriceSeries,
  mergeSeries,
  timeframeToDays,
} from './fetcher';
import { analyzeMergedSeries } from './analyzer';
import { loadThesisFactors } from './factors';
import { runThesisInLocalTee, wasmArtifactAvailable } from './local-tee';
import { fetchNearOnchainTelemetrySafe } from './near-rpc';
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
  nearMainnetRpcUrls,
} from './data-sources';
export {
  fetchNearOnchainTelemetry,
  fetchNearOnchainTelemetrySafe,
  yoctoToMillionNear,
} from './near-rpc';
export { hashThesisInput, hashOutput, sha256Hex, stableStringify } from './hash';
export { parseThesisInput } from './input';
export { buildRunReceipt, type RunReceipt } from './receipt';
export { callOutLayerThesis, isOutLayerConfigured } from './outlayer-coordinator';
export { runThesisInLocalTee, wasmArtifactAvailable } from './local-tee';
export { loadThesisFactors, loadMarketFactors, deriveSyntheticFactors, type ThesisFactors } from './factors';
export { computeTvlNetFlow7dMusd, fetchNearPerpFundingBps } from './market-factors';
export { planVaultExecution } from './vault';
export type { VaultExecutionPlan } from './vault';
export {
  pullMarketSnapshot,
  buildSeriesFromSnapshot,
  runThesisAnalysisFromSnapshot,
  factorsFromSnapshot,
  type HubDataSnapshot,
} from './snapshot-hub';
export type {
  AttestationBundle,
  NearOnchainTelemetry,
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
      const [remote, near_onchain] = await Promise.all([
        callOutLayerThesis(input),
        fetchNearOnchainTelemetrySafe(),
      ]);
      if (!remote) throw new Error('OutLayer returned no result');
      return near_onchain && !remote.near_onchain ? { ...remote, near_onchain } : remote;
    }
    if (wasmArtifactAvailable()) {
      return runThesisInLocalTee(input);
    }
    throw new Error(
      'Secure enclave requested: configure OutLayer (OUTLAYER_API_URL + OUTLAYER_PROJECT_ID) or build WASI (./outlayer/build-wasm.sh)',
    );
  }

  const days = timeframeToDays(input.timeframe);

  const [prices, tvls, near_onchain] = await Promise.all([
    fetchPriceSeries(input.target_token, days),
    fetchNearTvlSeries(days),
    fetchNearOnchainTelemetrySafe(),
  ]);

  const series = mergeSeries(prices, tvls);
  if (series.length < 3) {
    throw new Error(
      `Insufficient overlapping price/TVL days (price=${prices.length}, tvl=${tvls.length}, merged=${series.length})`,
    );
  }

  const factors = await loadThesisFactors(series);
  return analyzeMergedSeries(series, input, { ...options, factors, near_onchain });
}
