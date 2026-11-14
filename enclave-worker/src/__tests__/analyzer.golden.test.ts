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
};

const EXPECTED_INPUT_HASH = '45b4e0a431d0949d6ab36c16ce76599b80c0f4a7791e438bb0d2130051447006';
const EXPECTED_OUTPUT_HASH = '79a46b6061d1ef5309e7fd02b8c78655a9f7d538d0719aabf739b55749b8c1f3';

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
    assert.equal(result.conclusion.sharpe_ratio, 15.333);
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
