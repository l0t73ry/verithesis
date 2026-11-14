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

describe('backtestWeightedStrategy — no look-ahead', () => {
  it('is flat on day 1 and trades on the previous day signal only', () => {
    // Day 1: price +10%, TVL +10% → bullish signal, but it can only be traded from day 2.
    // Day 2 price is -10%, so a causal strategy LOSES here (a peeking one would have gained).
    const { dailyReturns } = backtestWeightedStrategy(miniSeries, 0.5);
    assert.equal(dailyReturns[0], 0);
    assert.ok(Math.abs(dailyReturns[1]! - -0.1) < 1e-12, `got ${dailyReturns[1]}`);
    // Day 2 signal is negative (price -10%, TVL -18%) → short into day 3's +6.06% rally.
    assert.ok(Math.abs(dailyReturns[2]! - -(105 - 99) / 99) < 1e-12, `got ${dailyReturns[2]}`);
  });

  it('is invariant to the absolute scale of TVL (relative changes only)', () => {
    const scaled = miniSeries.map((p) => ({ ...p, defi_tvl_usd: p.defi_tvl_usd * 1_000 }));
    assert.deepEqual(
      backtestWeightedStrategy(scaled, 0.8).dailyReturns,
      backtestWeightedStrategy(miniSeries, 0.8).dailyReturns,
    );
  });

  it('tvl_weight actually changes positions (TVL is not drowned out by price)', () => {
    // Price rises every day, TVL falls every day: opposite signals depending on the weight.
    const s: SeriesPoint[] = [100, 101, 102.01, 103.03, 104.06].map((p, i) => ({
      date: `2025-02-0${i + 1}`,
      price_usd: p,
      defi_tvl_usd: 1_000_000_000 * 0.98 ** i,
    }));
    const tvlHeavy = backtestWeightedStrategy(s, 0.8).dailyReturns;
    const priceHeavy = backtestWeightedStrategy(s, 0.2).dailyReturns;
    assert.ok(tvlHeavy[2]! < 0, 'TVL-led weighting shorts a rising price');
    assert.ok(priceHeavy[2]! > 0, 'price-led weighting goes long a rising price');
  });
});

describe('totalReturnPct', () => {
  it('sums compounded daily returns', () => {
    const ret = totalReturnPct([0.1, 0.1]);
    assert.equal(ret, 21);
  });
});
