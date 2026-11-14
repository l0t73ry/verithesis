#!/usr/bin/env node
/**
 * Cross-check WASM analyzer hashes vs enclave-worker (P0 gate).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeMergedSeries } from '../enclave-worker/src/analyzer.ts';
import { deriveSyntheticFactors } from '../enclave-worker/src/factors.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const wasm = join(root, 'outlayer/verithesis-wasi/target/wasm32-wasip1/release/verithesis-wasi.wasm');
const fixture = join(root, 'outlayer/fixtures/wasm-golden.json');

function main() {
  if (!existsSync(wasm)) {
    console.error('WASM missing. Run: npm run build:wasm');
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(fixture, 'utf8'));
  const { input, series, sealed_bias } = payload;
  const synth = deriveSyntheticFactors(series);
  const factors = {
    github_commits_7d: payload.factors?.github_commits_7d ?? 25,
    ...synth,
  };
  const wasmPayload = {
    input: { ...input, tvl_weight: input.tvl_weight ?? 0.5 },
    series,
    factors,
    sealed_bias,
  };
  process.env.VERITHESIS_SEALED_BIAS = String(sealed_bias ?? 0.08);

  const run = spawnSync('wasmtime', ['run', wasm, '--'], {
    input: JSON.stringify(wasmPayload),
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout);
    process.exit(run.status ?? 1);
  }
  const wasmOut = JSON.parse(run.stdout.trim());

  const host = analyzeMergedSeries(
    series,
  { ...input, tvl_weight: input.tvl_weight ?? 0.5 },
    { tee: true, factors },
  );
  const hostIn = host.attestation.input_hash;
  const hostOut = host.attestation.output_hash;

  if (wasmOut.input_hash !== hostIn) {
    console.error('input_hash mismatch');
    console.error(' wasm:', wasmOut.input_hash);
    console.error(' host:', hostIn);
    process.exit(1);
  }
  if (wasmOut.output_hash !== hostOut) {
    console.error('output_hash mismatch');
    console.error(' wasm:', wasmOut.output_hash);
    console.error(' host:', hostOut);
    process.exit(1);
  }
  console.log('verify-wasm OK', wasmOut.output_hash.slice(0, 16) + '…');
}

main();
