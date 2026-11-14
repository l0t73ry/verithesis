import { createHash } from 'node:crypto';
import type { ThesisInput } from './types';

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

export function hashThesisInput(input: ThesisInput): string {
  return sha256Hex(
    stableStringify({
      timeframe: input.timeframe,
      target_token: input.target_token,
      smoothing_window: input.smoothing_window ?? 1,
      tvl_weight: Math.round((input.tvl_weight ?? 0.5) * 1000) / 1000,
      strategy_mode: input.strategy_mode ?? 'public',
      realtime_unlocked: Boolean(input.realtime_unlocked),
    }),
  );
}

export function hashOutput(result: { series: unknown; conclusion: unknown }): string {
  return sha256Hex(
    stableStringify({
      conclusion: result.conclusion,
      series: result.series,
    }),
  );
}
