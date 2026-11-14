import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  backtestWeightedStrategy,
  buyAndHoldReturnPct,
  equityCurveFromReturns,
  maxDrawdownPct,
  sharpeRatio,
  totalReturnPct,
} from '../backtest.ts';
import type { SeriesPoint } from '../types.ts';

const miniSeries: SeriesPoint[] = [
  { date: '2025-01-01', price_usd: 100, defi_tvl_usd: 1_000_000 },
  { date: '2025-01-02', price_usd: 110, defi_tvl_usd: 1_100_000 },
  { date: '2025-01-03', price_usd: 99, defi_tvl_usd: 900_000 },
  { date: '2025-01-04', price_usd: 105, defi_tvl_usd: 1_050_000 },
];

describe('sharpeRatio', () => {
  it('returns 0 for flat returns', () => {
    assert.equal(sharpeRatio([0, 0, 0, 0]), 0);
  });

  it('is positive for consistently positive returns', () => {
    assert.ok(sharpeRatio([0.01, 0.02, 0.01, 0.015]) > 0);
  });
});

describe('maxDrawdownPct', () => {
  it('detects 50% drawdown', () => {
    const eq = equityCurveFromReturns([1, -0.5]);
    assert.equal(maxDrawdownPct(eq), 50);
  });
});

describe('backtestWeightedStrategy', () => {
  it('produces finite metrics on mini series', () => {
    const bt = backtestWeightedStrategy(miniSeries, 0.5);
    assert.equal(bt.dailyReturns.length, miniSeries.length - 1);
    assert.ok(Number.isFinite(bt.sharpe));
    assert.ok(bt.maxDrawdownPct >= 0);
    assert.ok(Number.isFinite(bt.totalReturnPct));
  });

  it('differs from buy-and-hold when weights favor TVL', () => {
    const bt = backtestWeightedStrategy(miniSeries, 0.8);
    const bh = buyAndHoldReturnPct(miniSeries);
    assert.notEqual(bt.totalReturnPct, bh);
  });
});

describe('totalReturnPct', () => {
  it('sums compounded daily returns', () => {
    const ret = totalReturnPct([0.1, 0.1]);
    assert.equal(ret, 21);
  });
});
