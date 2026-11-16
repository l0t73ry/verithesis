import { createHash } from 'node:crypto';
import { clampSmoothingWindow, normalizeTvlWeight } from './input';
import type { ThesisInput } from './types';

export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as object).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

/** Hashes the canonical (clamped) parameters — must stay in sync with `hash_thesis_input` in main.rs. */
export function hashThesisInput(input: ThesisInput): string {
  const base: Record<string, unknown> = {
    timeframe: input.timeframe,
    target_token: input.target_token,
    smoothing_window: clampSmoothingWindow(input.smoothing_window),
    tvl_weight: normalizeTvlWeight(input.tvl_weight),
    strategy_mode: input.strategy_mode ?? 'public',
    realtime_unlocked: Boolean(input.realtime_unlocked),
  };
  if (input.data_snapshot_id != null && Number.isFinite(input.data_snapshot_id)) {
    base.data_snapshot_id = Math.trunc(input.data_snapshot_id);
  }
  return sha256Hex(stableStringify(base));
}

export function hashOutput(result: { series: unknown; conclusion: unknown }): string {
  return sha256Hex(
    stableStringify({
      conclusion: result.conclusion,
      series: result.series,
    }),
  );
}
