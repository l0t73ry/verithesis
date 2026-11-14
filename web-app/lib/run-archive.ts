import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { buildRunReceipt } from '@verithesis/enclave-worker';
import type { ThesisResult } from '@verithesis/enclave-worker';
import { resolveDataDir } from './data-dir';
import { readJsonSafe, writeFileAtomic } from './fs-json';
import { isFullHash, normalizeRunRef, refMatches } from './run-ref';

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
const ARCHIVE_FILE_RE = /^[0-9a-f]{64}\.json$/;

let legacyMigrated = false;

function ensureDirs() {
  for (const dir of [DATA_DIR, RUNS_DIR, RECEIPTS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// File names come from hashes. Every path builder asserts a full 64-hex hash, so even a caller
// that forgets to validate cannot escape RUNS_DIR / RECEIPTS_DIR.
function runPath(outputHash: string) {
  if (!isFullHash(outputHash)) throw new Error('Invalid output_hash');
  return join(RUNS_DIR, `${outputHash}.json`);
}

function receiptPath(outputHash: string) {
  if (!isFullHash(outputHash)) throw new Error('Invalid output_hash');
  return join(RECEIPTS_DIR, `${outputHash}.json`);
}

function loadIndexRaw(): RunIndexEntry[] {
  const rows = readJsonSafe<unknown>(INDEX_FILE, []);
  if (!Array.isArray(rows)) return [];
  return (rows as RunIndexEntry[]).filter(
    (e) => e && isFullHash(e.output_hash) && typeof e.input_hash === 'string' && typeof e.saved_at === 'string',
  );
}

function loadIndex(): RunIndexEntry[] {
  ensureDirs();
  ensureLegacyMigrated();
  return loadIndexRaw();
}

function saveIndex(entries: RunIndexEntry[]) {
  ensureDirs();
  writeFileAtomic(INDEX_FILE, JSON.stringify(entries, null, 2));
}

function readRunFile(outputHash: string): ThesisResult | null {
  return readJsonSafe<ThesisResult | null>(runPath(outputHash), null);
}

function ensureLegacyMigrated() {
  if (legacyMigrated) return;
  legacyMigrated = true;
  migrateLegacyArchive();
}

function migrateLegacyArchive() {
  if (!existsSync(LEGACY_FILE)) return;
  ensureDirs();
  const all = readJsonSafe<Record<string, ThesisResult>>(LEGACY_FILE, {});
  const index = loadIndexRaw();
  const seen = new Set(index.map((e) => e.output_hash));

  for (const result of Object.values(all)) {
    const out = result?.attestation?.output_hash;
    if (!isFullHash(out) || !isFullHash(result.attestation.input_hash) || seen.has(out)) continue;
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

function writeRunArtifacts(result: ThesisResult) {
  const out = result.attestation.output_hash;
  writeFileAtomic(runPath(out), JSON.stringify(result));
  writeFileAtomic(receiptPath(out), JSON.stringify(buildRunReceipt(result), null, 2));
}

function pruneDir(dir: string, keepSet: Set<string>) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    // Only ever touch files we created; leave stray/temp files alone.
    if (!ARCHIVE_FILE_RE.test(name) || keepSet.has(name.slice(0, -'.json'.length))) continue;
    try {
      unlinkSync(join(dir, name));
    } catch (e) {
      console.error(`[verithesis] prune failed for ${name}:`, e);
    }
  }
}

function pruneRunFiles(keep: RunIndexEntry[]) {
  const keepSet = new Set(keep.map((e) => e.output_hash));
  pruneDir(RUNS_DIR, keepSet);
  pruneDir(RECEIPTS_DIR, keepSet);
}

/** Persist a run. Throws if the result's hashes are not 64-char hex (they become file names). */
export function archiveRun(result: ThesisResult): void {
  const { output_hash, input_hash, execution_timestamp } = result.attestation;
  if (!isFullHash(output_hash) || !isFullHash(input_hash)) {
    throw new Error('Refusing to archive run with malformed attestation hashes');
  }
  ensureDirs();
  ensureLegacyMigrated();

  writeRunArtifacts(result);

  const entry: RunIndexEntry = { output_hash, input_hash, saved_at: execution_timestamp };
  const index = loadIndexRaw().filter((e) => e.output_hash !== output_hash);
  const next = [entry, ...index].slice(0, MAX_RUNS);
  saveIndex(next);
  pruneRunFiles(next);
}

export function findRunReceipt(outputHash: string) {
  if (!isFullHash(outputHash)) return null;
  return readJsonSafe<unknown>(receiptPath(outputHash), null);
}

/** Resolve by output_hash (preferred) or input_hash (latest run for that config). Prefixes ≥ 8 hex ok. */
export function findRunByHash(ref: string): ThesisResult | null {
  const h = normalizeRunRef(ref);
  if (!h) return null;
  ensureDirs();
  ensureLegacyMigrated();

  if (isFullHash(h)) {
    const direct = readRunFile(h);
    if (direct) return direct;
  }

  const index = loadIndex();
  const outHit = index.find((e) => refMatches(e.output_hash, h));
  if (outHit) {
    const run = readRunFile(outHit.output_hash);
    if (run) return run;
  }

  const inputMatches = index.filter((e) => refMatches(e.input_hash, h));
  if (inputMatches.length === 0) return null;
  inputMatches.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  return readRunFile(inputMatches[0]!.output_hash);
}
