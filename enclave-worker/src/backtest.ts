import type { SeriesPoint } from './types';
import { pctChange } from './math';

export function dailyPriceReturns(series: SeriesPoint[]): number[] {
  return pctChange(series.map((s) => s.price_usd));
}

export function sharpeRatio(dailyReturns: number[], periodsPerYear = 252): number {
  const r = dailyReturns.filter((x) => Number.isFinite(x));
  if (r.length < 2) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
  const std = Math.sqrt(variance);
  if (!std) return 0;
  const sharpe = (mean / std) * Math.sqrt(periodsPerYear);
  return Math.round(sharpe * 1000) / 1000;
}

export function maxDrawdownPct(equity: number[]): number {
  if (equity.length < 2) return 0;
  let peak = equity[0]!;
  let mdd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > mdd) mdd = dd;
  }
  return Math.round(mdd * 1000) / 10;
}

export function equityCurveFromReturns(dailyReturns: number[], start = 1): number[] {
  const eq = [start];
  for (const r of dailyReturns) {
    eq.push(eq[eq.length - 1]! * (1 + r));
  }
  return eq;
}

export function totalReturnPct(dailyReturns: number[]): number {
  const eq = equityCurveFromReturns(dailyReturns);
  const end = eq[eq.length - 1] ?? 1;
  return Math.round((end - 1) * 1000) / 10;
}

/**
 * Weighted co-move strategy. The position held on day k is decided from day k-1's
 * *relative* changes: sign(w_tvl·ΔTVL% + w_mom·Δprice%), then applied to day k's price return
 * (no look-ahead). Day 1 has no prior signal, so it is flat. Returns are aligned with
 * price returns (length = series.length - 1).
 */
export function backtestWeightedStrategy(
  series: SeriesPoint[],
  tvlWeight: number,
): { dailyReturns: number[]; sharpe: number; maxDrawdownPct: number; totalReturnPct: number } {
  const wTvl = Math.max(0.2, Math.min(0.8, tvlWeight));
  const wMom = 1 - wTvl;
  const priceCh = pctChange(series.map((s) => s.price_usd));
  const tvlCh = pctChange(series.map((s) => s.defi_tvl_usd));
  const stratRets: number[] = [];

  for (let k = 0; k < priceCh.length; k++) {
    let pos = 0;
    if (k > 0) {
      const score = wTvl * tvlCh[k - 1]! + wMom * priceCh[k - 1]!;
      if (score > 0) pos = 1;
      else if (score < 0) pos = -1;
    }
    stratRets.push(pos * priceCh[k]!);
  }

  const eq = equityCurveFromReturns(stratRets);
  return {
    dailyReturns: stratRets,
    sharpe: sharpeRatio(stratRets),
    maxDrawdownPct: maxDrawdownPct(eq),
    totalReturnPct: totalReturnPct(stratRets),
  };
}

export function buyAndHoldReturnPct(series: SeriesPoint[]): number {
  return totalReturnPct(dailyPriceReturns(series));
}
