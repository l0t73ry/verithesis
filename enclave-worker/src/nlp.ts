import type { TargetToken, ThesisInput, Timeframe } from './types';

/** Rule-based NL → parameters (P1). Optional LLM can wrap this later. */
export function parseNaturalQuery(query: string): Partial<ThesisInput> {
  const q = query.toLowerCase();
  const out: Partial<ThesisInput> = {};

  if (/\b(7d|7\s*天|一周)\b/.test(q)) out.timeframe = '7d';
  else if (/\b(90d|90\s*天|三个月)\b/.test(q)) out.timeframe = '90d';
  else if (/\b(30d|30\s*天|一个月)\b/.test(q)) out.timeframe = '30d';

  if (/\bref\b/.test(q)) out.target_token = 'REF';
  else if (/\bnear\b/.test(q)) out.target_token = 'NEAR';

  const smooth = q.match(/(?:平滑|窗口|window)\s*(\d{1,2})/);
  if (smooth) out.smoothing_window = Math.min(14, Math.max(1, Number(smooth[1])));

  const tvlW = q.match(/(?:tvl|权重)\s*(\d{1,2})\s*%?/i);
  if (tvlW) out.tvl_weight = Math.min(80, Math.max(20, Number(tvlW[1]))) / 100;
  else if (/14\s*天/.test(q) && !out.timeframe) {
    out.smoothing_window = 14;
    out.timeframe = '30d';
  }

  if (/私密|黑盒|sealed|alpha/.test(q)) out.strategy_mode = 'sealed';
  if (/公开|public/.test(q)) out.strategy_mode = 'public';

  return out;
}
