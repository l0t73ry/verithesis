import { fetchNearTvlSeries, fetchPriceSeries, mergeSeries, timeframeToDays } from './fetcher';
import { deriveSyntheticFactors, fetchGithubCommits7d, type ThesisFactors } from './factors';
import { analyzeMergedSeries } from './analyzer';
import { fetchNearOnchainTelemetrySafe } from './near-rpc';
import type { NearOnchainTelemetry, TargetToken, ThesisInput, ThesisResult, Timeframe } from './types';

/** Hub DB row shape (raw layers, 90d window). */
export type HubDataSnapshot = {
  id: number;
  fetched_at: string;
  status: 'ok' | 'degraded' | 'failed';
  near_rpc: NearOnchainTelemetry | null;
  prices_near: { date: string; price: number }[];
  prices_ref: { date: string; price: number }[];
  tvl_near: { date: string; tvl: number }[];
  github_commits_7d: number;
};

export async function pullMarketSnapshot(): Promise<Omit<HubDataSnapshot, 'id' | 'fetched_at' | 'status'>> {
  const days = 90;
  const [prices_near, prices_ref, tvl_near, near_rpc, github_commits_7d] = await Promise.all([
    fetchPriceSeries('NEAR', days),
    fetchPriceSeries('REF', days),
    fetchNearTvlSeries(days),
    fetchNearOnchainTelemetrySafe(),
    fetchGithubCommits7d(),
  ]);
  return { prices_near, prices_ref, tvl_near, near_rpc: near_rpc ?? null, github_commits_7d };
}

function sliceByTimeframe<T extends { date: string }>(rows: T[], timeframe: Timeframe): T[] {
  const days = timeframeToDays(timeframe);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= cutoffKey);
}

export function buildSeriesFromSnapshot(
  snapshot: HubDataSnapshot,
  token: TargetToken,
  timeframe: Timeframe,
) {
  const prices = sliceByTimeframe(token === 'REF' ? snapshot.prices_ref : snapshot.prices_near, timeframe);
  const tvls = sliceByTimeframe(snapshot.tvl_near, timeframe);
  return mergeSeries(prices, tvls);
}

export function factorsFromSnapshot(snapshot: HubDataSnapshot, series: ReturnType<typeof mergeSeries>): ThesisFactors {
  const synth = deriveSyntheticFactors(series);
  return {
    github_commits_7d: snapshot.github_commits_7d,
    ...synth,
  };
}

export async function runThesisAnalysisFromSnapshot(
  input: ThesisInput,
  snapshot: HubDataSnapshot,
  options?: { tee?: boolean; data_snapshot_id?: number },
): Promise<ThesisResult> {
  const series = buildSeriesFromSnapshot(snapshot, input.target_token, input.timeframe);
  if (series.length < 3) {
    throw new Error(
      `Insufficient overlapping days in snapshot #${snapshot.id} (merged=${series.length})`,
    );
  }
  const factors = factorsFromSnapshot(snapshot, series);
  const enriched: ThesisInput = {
    ...input,
    ...(options?.data_snapshot_id != null ? { data_snapshot_id: options.data_snapshot_id } : {}),
  };
  return analyzeMergedSeries(series, enriched, {
    ...options,
    factors,
    near_onchain: snapshot.near_rpc ?? undefined,
    provider: options?.tee ? undefined : 'local-dev',
  });
}