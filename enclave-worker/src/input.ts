import type { StrategyMode, TargetToken, ThesisInput, Timeframe } from './types';

const SMOOTHING_WINDOW_MIN = 1;
const SMOOTHING_WINDOW_MAX = 14;
const TVL_WEIGHT_MIN = 0.2;
const TVL_WEIGHT_MAX = 0.8;

const TIMEFRAMES: readonly Timeframe[] = ['7d', '30d', '90d'];
const TOKENS: readonly TargetToken[] = ['NEAR', 'REF'];
const MODES: readonly StrategyMode[] = ['public', 'sealed'];

/** Integer window in [1, 14]; non-finite input falls back to 1 (no smoothing). */
export function clampSmoothingWindow(w: number | undefined): number {
  if (w == null || !Number.isFinite(w)) return SMOOTHING_WINDOW_MIN;
  return Math.max(SMOOTHING_WINDOW_MIN, Math.min(SMOOTHING_WINDOW_MAX, Math.round(w)));
}

/** TVL weight clamped to [0.2, 0.8] and rounded to 3 decimals; non-finite falls back to 0.5. */
export function normalizeTvlWeight(w: number | undefined): number {
  const x = w == null || !Number.isFinite(w) ? 0.5 : w;
  return Math.round(Math.max(TVL_WEIGHT_MIN, Math.min(TVL_WEIGHT_MAX, x)) * 1000) / 1000;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T, field: string): T {
  if (value == null) return fallback;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${field}`);
}

function pickFiniteNumber(value: unknown, fallback: number, field: string): number {
  if (value == null) return fallback;
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`Invalid ${field}`);
  return n;
}

/**
 * Strict boundary parser for untrusted request bodies. Rejects bad enums / non-finite numbers
 * and returns the canonical form that is hashed (so TS, WASI and archives agree).
 * `realtime_unlocked` / `payment_receipt` are NOT read from the body — callers decide those.
 */
export function parseThesisInput(body: unknown): Pick<
  ThesisInput,
  'timeframe' | 'target_token' | 'smoothing_window' | 'tvl_weight' | 'strategy_mode'
> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }
  const o = body as Record<string, unknown>;
  return {
    timeframe: pickEnum(o.timeframe, TIMEFRAMES, '30d', 'timeframe'),
    target_token: pickEnum(o.target_token, TOKENS, 'NEAR', 'target_token'),
    smoothing_window: clampSmoothingWindow(pickFiniteNumber(o.smoothing_window, 1, 'smoothing_window')),
    tvl_weight: normalizeTvlWeight(pickFiniteNumber(o.tvl_weight, 0.5, 'tvl_weight')),
    strategy_mode: pickEnum(o.strategy_mode, MODES, 'public', 'strategy_mode'),
  };
}
