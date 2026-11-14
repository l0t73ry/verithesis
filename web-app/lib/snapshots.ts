import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SnapshotRecord } from '@verithesis/enclave-worker';
import { resolveDataDir } from './data-dir';
import { readJsonSafe, writeFileAtomic } from './fs-json';

const DATA_DIR = resolveDataDir();
const FILE = join(DATA_DIR, 'snapshots.json');
const MAX_SNAPSHOTS = 50;

export function listSnapshots(): SnapshotRecord[] {
  const rows = readJsonSafe<unknown>(FILE, []);
  return Array.isArray(rows) ? (rows as SnapshotRecord[]) : [];
}

export function appendSnapshot(row: SnapshotRecord): SnapshotRecord[] {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const next = [row, ...listSnapshots().filter((s) => s.id !== row.id)].slice(0, MAX_SNAPSHOTS);
  writeFileAtomic(FILE, JSON.stringify(next, null, 2));
  return next;
}
