import type { SeriesPoint, StrategyMode, ThesisConclusion } from '@verithesis/enclave-worker';

const BULL_R = 0.25;
const BEAR_R = -0.15;
const BEAR_MOM = -0.05;
const BULL_MOM = 0;

export type SignalExplainKey =
  | 'triggerBullComposite'
  | 'triggerBullMom'
  | 'triggerBearComposite'
  | 'triggerBearMom'
  | 'triggerNeutral'
  | 'downgradeGh'
  | 'downgradeFunding'
  | 'downgradeWhale';

export function recentMomFromSeries(series: SeriesPoint[]): number {
  if (series.length < 4) return 0;
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!.price_usd;
    if (!prev) out.push(0);
    else out.push((series[i]!.price_usd - prev) / prev);
  }
  return out.slice(-3).reverse().reduce((a, b) => a + b, 0);
}

export function signalExplainKeys(
  conclusion: ThesisConclusion,
  series: SeriesPoint[],
  _mode: StrategyMode,
): SignalExplainKey[] {
  const mom = recentMomFromSeries(series);
  const r = conclusion.pearson_r;
  const keys: SignalExplainKey[] = [];

  if (conclusion.signal === 'bullish') {
    keys.push('triggerBullComposite', 'triggerBullMom');
    return keys;
  }
  if (conclusion.signal === 'bearish') {
    if (r < BEAR_R) keys.push('triggerBearComposite');
    if (mom < BEAR_MOM) keys.push('triggerBearMom');
    if (!keys.length) keys.push('triggerBearMom');
    return keys;
  }

  if (r > BULL_R && mom <= BULL_MOM) keys.push('triggerBullMom');
  else if (r <= BULL_R && mom > BULL_MOM) keys.push('triggerBullComposite');
  else keys.push('triggerNeutral');

  const gh = conclusion.github_commits_7d ?? 0;
  const funding = conclusion.funding_rate_bps ?? 0;
  const whale = conclusion.whale_net_flow_musd ?? 0;
  if (r > BULL_R && mom > BULL_MOM) {
    if (gh < 12) keys.push('downgradeGh');
    if (funding > 12) keys.push('downgradeFunding');
    if (whale < -2) keys.push('downgradeWhale');
  }
  return keys;
}

export function formatRecentMomPct(series: SeriesPoint[]): string {
  return `${(recentMomFromSeries(series) * 100).toFixed(2)}%`;
}