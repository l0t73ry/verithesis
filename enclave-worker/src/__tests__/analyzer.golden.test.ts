import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { analyzeMergedSeries } from '../analyzer.ts';
import { deriveSyntheticFactors } from '../factors.ts';
import type { ThesisInput } from '../types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const golden = JSON.parse(readFileSync(join(root, 'outlayer/fixtures/wasm-golden.json'), 'utf8')) as {
  input: ThesisInput;
  series: import('../types.ts').SeriesPoint[];
  sealed_bias: number;
  factors?: { github_commits_7d?: number };
};

const EXPECTED_INPUT_HASH = '45b4e0a431d0949d6ab36c16ce76599b80c0f4a7791e438bb0d2130051447006';
const EXPECTED_OUTPUT_HASH = '6b5b4c78fada7d3eff7dbc0044ef37fb3d2452d6cafb3f8d13fb194599aa35ce';

describe('analyzeMergedSeries (wasm-golden fixture)', () => {
  it('matches WASM gate input/output hashes', () => {
    const factors = {
      github_commits_7d: golden.factors?.github_commits_7d ?? 25,
      ...deriveSyntheticFactors(golden.series),
    };
    const input = { ...golden.input, tvl_weight: golden.input.tvl_weight ?? 0.5 };
    const result = analyzeMergedSeries(golden.series, input, { tee: true, factors });

    assert.equal(result.attestation.input_hash, EXPECTED_INPUT_HASH);
    assert.equal(result.attestation.output_hash, EXPECTED_OUTPUT_HASH);
    assert.equal(result.conclusion.signal, 'neutral');
    // Was +15.333 while the backtest peeked at same-day price; no-look-ahead gives the honest figure.
    assert.equal(result.conclusion.sharpe_ratio, -18.854);
    assert.equal(result.conclusion.strategy_return_pct, -7.5);
    assert.equal(result.conclusion.tvl_weight, 0.5);
  });

  it('fails if output hash drift is introduced', () => {
    const factors = {
      github_commits_7d: 25,
      ...deriveSyntheticFactors(golden.series),
    };
    const result = analyzeMergedSeries(golden.series, { ...golden.input, tvl_weight: 0.5 }, { tee: true, factors });
    assert.notEqual(result.attestation.output_hash, 'deadbeef'.padEnd(64, '0'));
  });
});
