import type { Messages } from '@/lib/i18n/catalog';
import type { StrategyMode, TargetToken, ThesisConclusion } from '@verithesis/enclave-worker';

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), template);
}

/** UI + share card: Sharpe / drawdown / returns (Pearson etc. live under expand metrics). */
export function formatConclusionBrief(
  copy: Messages['conclusion'],
  conclusion: ThesisConclusion,
  token: TargetToken,
  mode: StrategyMode,
): { headline: string; summary: string } {
  const sealed = mode === 'sealed' ? copy.sealedNote : '';
  const headlineTpl = copy.headline[conclusion.signal];
  const headline = applyTemplate(headlineTpl, { token, sealed });
  const summary = applyTemplate(copy.summaryShort, {
    sharpe: (conclusion.sharpe_ratio ?? 0).toFixed(2),
    mdd: String(conclusion.max_drawdown_pct ?? 0),
    strat: String(conclusion.strategy_return_pct ?? 0),
    bh: String(conclusion.buy_hold_return_pct ?? 0),
    disclaimer: copy.disclaimer,
  });
  return { headline, summary };
}
