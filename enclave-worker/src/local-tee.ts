import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchNearTvlSeries,
  fetchPriceSeries,
  mergeSeries,
  timeframeToDays,
} from './fetcher';
import { analyzeMergedSeries } from './analyzer';
import { loadThesisFactors } from './factors';
import type { ThesisInput, ThesisResult, SeriesPoint } from './types';

const DEFAULT_WASM_REL = join(
  'outlayer',
  'verithesis-wasi',
  'target',
  'wasm32-wasip1',
  'release',
  'verithesis-wasi.wasm',
);

function repoWasmPath(): string {
  const fromEnv = process.env.VERITHESIS_WASM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const cwd = process.cwd();
  const candidates = [
    join(cwd, DEFAULT_WASM_REL),
    join(cwd, '..', DEFAULT_WASM_REL),
    join(cwd, '..', '..', DEFAULT_WASM_REL),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

export function wasmArtifactAvailable(): boolean {
  return existsSync(repoWasmPath());
}

export function wasmCodeMeasurement(): string | null {
  const path = repoWasmPath();
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return `wasm:sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

type WasmAnalyzePayload = {
  input: ThesisInput;
  series: SeriesPoint[];
  factors?: import('./factors').ThesisFactors;
  sealed_bias?: number;
};

type WasmAnalyzeOutput = {
  input_hash: string;
  output_hash: string;
  conclusion: ThesisResult['conclusion'];
};

function wasmSealedBias(): number {
  const n = Number.parseFloat(process.env.VERITHESIS_SEALED_BIAS ?? '0.08');
  return Number.isFinite(n) ? n : 0.08;
}

function runWasmAnalyzer(payload: WasmAnalyzePayload): Promise<WasmAnalyzeOutput> {
  const wasm = repoWasmPath();
  return new Promise((resolve, reject) => {
    const child = spawn('wasmtime', ['run', wasm, '--'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.on('error', (e) => {
      reject(new Error(`wasmtime not found: ${e.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `wasmtime exit ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as WasmAnalyzeOutput;
        if (!parsed.output_hash || !parsed.input_hash) {
          reject(new Error('WASM output missing hashes'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error(`Invalid WASM JSON: ${stdout.slice(0, 200)}`));
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

/** Local TEE path: pin WASM measurement, optional wasmtime gate, then analyze with tee attestation. */
export async function runThesisInLocalTee(input: ThesisInput): Promise<ThesisResult> {
  const measurement = wasmCodeMeasurement();
  if (!measurement) {
    throw new Error(
      'WASI module missing. Run: ./outlayer/build-wasm.sh (requires Rust + wasm32-wasip1 + wasmtime)',
    );
  }

  const days = timeframeToDays(input.timeframe);
  const [prices, tvls] = await Promise.all([
    fetchPriceSeries(input.target_token, days),
    fetchNearTvlSeries(days),
  ]);
  const series: SeriesPoint[] = mergeSeries(prices, tvls);
  if (series.length < 3) {
    throw new Error(`Insufficient overlapping days (merged=${series.length})`);
  }

  const factors = await loadThesisFactors(series);
  const wasmPayload: WasmAnalyzePayload = {
    input: {
      timeframe: input.timeframe,
      target_token: input.target_token,
      smoothing_window: input.smoothing_window,
      tvl_weight: input.tvl_weight,
      strategy_mode: input.strategy_mode,
      realtime_unlocked: input.realtime_unlocked,
    },
    series,
    factors,
    sealed_bias: wasmSealedBias(),
  };

  const host = analyzeMergedSeries(series, { ...input, code_measurement: measurement }, { tee: true, factors });

  if (process.env.VERITHESIS_WASM_SKIP_GATE === '1') {
    return host;
  }

  const wasm = await runWasmAnalyzer(wasmPayload);
  if (wasm.input_hash !== host.attestation.input_hash || wasm.output_hash !== host.attestation.output_hash) {
    throw new Error(
      `WASM hash mismatch (in wasm=${wasm.input_hash.slice(0, 12)} host=${host.attestation.input_hash.slice(0, 12)}; ` +
        `out wasm=${wasm.output_hash.slice(0, 12)} host=${host.attestation.output_hash.slice(0, 12)})`,
    );
  }

  return host;
}
