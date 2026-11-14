import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  renameSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRunReceipt } from '@verithesis/enclave-worker';
import type { ThesisResult } from '@verithesis/enclave-worker';

function resolveDataDir(): string {
  if (process.env.VERITHESIS_DATA_DIR) return process.env.VERITHESIS_DATA_DIR;
  if (process.env.VERCEL || process.cwd().startsWith('/var/task')) {
    return join(tmpdir(), 'verithesis-data');
  }
  return join(process.cwd(), '.data');
}

const DATA_DIR = resolveDataDir();
const RUNS_DIR = join(DATA_DIR, 'runs');
const RECEIPTS_DIR = join(DATA_DIR, 'receipts');
const INDEX_FILE = join(DATA_DIR, 'runs-index.json');
const LEGACY_FILE = join(DATA_DIR, 'runs-archive.json');

type RunIndexEntry = {
  output_hash: string;
  input_hash: string;
  saved_at: string;
};

const MAX_RUNS = 50;

let legacyMigrated = false;

function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
  if (!existsSync(RECEIPTS_DIR)) mkdirSync(RECEIPTS_DIR, { recursive: true });
}

function ensureLegacyMigrated() {
  if (legacyMigrated) return;
  legacyMigrated = true;
  migrateLegacyArchive();
}

function loadIndex(): RunIndexEntry[] {
  ensureDirs();
  ensureLegacyMigrated();
  if (!existsSync(INDEX_FILE)) {
    writeFileSync(INDEX_FILE, '[]', 'utf8');
    return [];
  }
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8')) as RunIndexEntry[];
}

function saveIndex(entries: RunIndexEntry[]) {
  ensureDirs();
  writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function runPath(outputHash: string) {
  return join(RUNS_DIR, `${outputHash}.json`);
}

function receiptPath(outputHash: string) {
  return join(RECEIPTS_DIR, `${outputHash}.json`);
}

function readRunFile(outputHash: string): ThesisResult | null {
  const path = runPath(outputHash);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as ThesisResult;
}

function migrateLegacyArchive() {
  if (!existsSync(LEGACY_FILE)) return;
  ensureDirs();
  const all = JSON.parse(readFileSync(LEGACY_FILE, 'utf8')) as Record<string, ThesisResult>;
  const index: RunIndexEntry[] = loadIndexWithoutMigrate();
  const seen = new Set(index.map((e) => e.output_hash));

  for (const result of Object.values(all)) {
    const out = result?.attestation?.output_hash;
    if (!out || seen.has(out)) continue;
    writeRunArtifacts(result);
    index.unshift({
      output_hash: out,
      input_hash: result.attestation.input_hash,
      saved_at: result.attestation.execution_timestamp,
    });
    seen.add(out);
  }

  const trimmed = index.slice(0, MAX_RUNS);
  saveIndex(trimmed);
  pruneRunFiles(trimmed);
  renameSync(LEGACY_FILE, `${LEGACY_FILE}.migrated`);
}

function loadIndexWithoutMigrate(): RunIndexEntry[] {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8')) as RunIndexEntry[];
}

function writeRunArtifacts(result: ThesisResult) {
  const out = result.attestation.output_hash;
  writeFileSync(runPath(out), JSON.stringify(result), 'utf8');
  writeFileSync(receiptPath(out), JSON.stringify(buildRunReceipt(result), null, 2), 'utf8');
}

function pruneRunFiles(keep: RunIndexEntry[]) {
  const keepSet = new Set(keep.map((e) => e.output_hash));
  if (!existsSync(RUNS_DIR)) return;
  for (const name of readdirSync(RUNS_DIR)) {
    const hash = name.replace(/\.json$/, '');
    if (!keepSet.has(hash)) {
      try {
        unlinkSync(join(RUNS_DIR, name));
        unlinkSync(receiptPath(hash));
      } catch {
        /* ignore */
      }
    }
  }
}

export function archiveRun(result: ThesisResult): void {
  ensureDirs();
  ensureLegacyMigrated();

  const entry: RunIndexEntry = {
    output_hash: result.attestation.output_hash,
    input_hash: result.attestation.input_hash,
    saved_at: result.attestation.execution_timestamp,
  };

  writeRunArtifacts(result);

  const index = loadIndex().filter((e) => e.output_hash !== entry.output_hash);
  const next = [entry, ...index].slice(0, MAX_RUNS);
  saveIndex(next);
  pruneRunFiles(next);
}

export function findRunReceipt(outputHash: string) {
  const path = receiptPath(outputHash.trim());
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeRef(ref: string) {
  return ref.trim().toLowerCase();
}

function matchesPrefix(haystack: string, needle: string) {
  return haystack === needle || haystack.startsWith(needle) || needle.startsWith(haystack);
}

/** Resolve by output_hash (preferred) or input_hash (latest run for that config). */
export function findRunByHash(ref: string): ThesisResult | null {
  const h = normalizeRef(ref);
  if (!h) return null;
  ensureDirs();
  ensureLegacyMigrated();

  const direct = readRunFile(h);
  if (direct) return direct;

  const index = loadIndex();
  const outHit = index.find((e) => matchesPrefix(e.output_hash, h));
  if (outHit) {
    const run = readRunFile(outHit.output_hash);
    if (run) return run;
  }

  const inputMatches = index.filter((e) => matchesPrefix(e.input_hash, h));
  if (inputMatches.length === 0) return null;
  inputMatches.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  return readRunFile(inputMatches[0]!.output_hash);
}
