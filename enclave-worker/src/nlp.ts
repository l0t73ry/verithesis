import type { ThesisInput } from './types';

/**
 * ASCII word boundaries. `\b` cannot be used here: it only recognises ASCII word characters,
 * so it never matches after a CJK character such as `天` at the end of a sentence.
 */
const START = '(?<![a-z0-9])';
const END = '(?![a-z0-9])';
const re = (body: string, flags = '') => new RegExp(`${START}(?:${body})${END}`, flags);

const TF_7D = re('7d|7\\s*天|一周');
const TF_90D = re('90d|90\\s*天|三个月');
const TF_30D = re('30d|30\\s*天|一个月');
const TOKEN_REF = re('ref');
const TOKEN_NEAR = re('near');

/** Rule-based NL → parameters (P1). Optional LLM can wrap this later. */
export function parseNaturalQuery(query: string): Partial<ThesisInput> {
  const q = query.toLowerCase();
  const out: Partial<ThesisInput> = {};

  if (TF_7D.test(q)) out.timeframe = '7d';
  else if (TF_90D.test(q)) out.timeframe = '90d';
  else if (TF_30D.test(q)) out.timeframe = '30d';

  if (TOKEN_REF.test(q)) out.target_token = 'REF';
  else if (TOKEN_NEAR.test(q)) out.target_token = 'NEAR';

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
