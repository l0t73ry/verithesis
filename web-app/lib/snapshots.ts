import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SnapshotRecord } from '@verithesis/enclave-worker';

const DATA_DIR = join(process.cwd(), '.data');
const FILE = join(DATA_DIR, 'snapshots.json');

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, '[]', 'utf8');
}

export function listSnapshots(): SnapshotRecord[] {
  ensure();
  return JSON.parse(readFileSync(FILE, 'utf8')) as SnapshotRecord[];
}

export function appendSnapshot(row: SnapshotRecord): SnapshotRecord[] {
  ensure();
  const all = listSnapshots();
  const next = [row, ...all].slice(0, 50);
  writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
