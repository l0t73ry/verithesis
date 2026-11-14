import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WASI } from 'node:wasi';
import {
  fetchNearTvlSeries,
  fetchPriceSeries,
  mergeSeries,
  timeframeToDays,
} from './fetcher';
import { analyzeMergedSeries } from './analyzer';
import { loadThesisFactors } from './factors';
import type { ThesisInput, ThesisResult, SeriesPoint } from './types';

const BUNDLED_WASM_REL = join('enclave-worker', 'wasm', 'verithesis-wasi.wasm');
const TARGET_WASM_REL = join(
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
  const candidates: string[] = [
    join(cwd, TARGET_WASM_REL),
    join(cwd, '..', TARGET_WASM_REL),
    join(cwd, BUNDLED_WASM_REL),
    join(cwd, '..', BUNDLED_WASM_REL),
    join(cwd, 'wasm', 'verithesis-wasi.wasm'),
    join(cwd, 'public', 'verithesis-wasi.wasm'),
    join(cwd, 'web-app', 'public', 'verithesis-wasi.wasm'),
  ];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(here, '..', 'wasm', 'verithesis-wasi.wasm'));
  } catch {
    /* ignore */
  }
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
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

let cachedWasmModule: { path: string; mod: WebAssembly.Module } | null = null;

function getWasmModule(wasmPath: string): WebAssembly.Module {
  if (cachedWasmModule && cachedWasmModule.path === wasmPath) {
    return cachedWasmModule.mod;
  }
  const mod = new WebAssembly.Module(readFileSync(wasmPath));
  cachedWasmModule = { path: wasmPath, mod };
  return mod;
}

function runWasmAnalyzer(payload: WasmAnalyzePayload): Promise<WasmAnalyzeOutput> {
  const wasmPath = repoWasmPath();
  const dir = mkdtempSync(join(tmpdir(), 'vt-wasi-'));
  const inPath = join(dir, 'in.json');
  const outPath = join(dir, 'out.json');
  const errPath = join(dir, 'err.txt');

  writeFileSync(inPath, JSON.stringify(payload), 'utf8');
  const stdinFd = openSync(inPath, 'r');
  const stdoutFd = openSync(outPath, 'w');
  const stderrFd = openSync(errPath, 'w');

  try {
    const wasi = new WASI({
      version: 'preview1',
      stdin: stdinFd,
      stdout: stdoutFd,
      stderr: stderrFd,
    });
    const mod = getWasmModule(wasmPath);
    const instance = new WebAssembly.Instance(mod, wasi.getImportObject() as WebAssembly.Imports);
    wasi.start(instance);
  } finally {
    try {
      closeSync(stdinFd);
    } catch {
      /* ignore */
    }
    try {
      closeSync(stdoutFd);
    } catch {
      /* ignore */
    }
    try {
      closeSync(stderrFd);
    } catch {
      /* ignore */
    }
  }

  try {
    const stdout = readFileSync(outPath, 'utf8').trim();
    const stderr = readFileSync(errPath, 'utf8').trim();
    if (!stdout) {
      throw new Error(stderr || 'Empty WASM output');
    }
    const parsed = JSON.parse(stdout) as WasmAnalyzeOutput;
    if (!parsed.output_hash || !parsed.input_hash) {
      throw new Error('WASM output missing hashes');
    }
    return Promise.resolve(parsed);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
