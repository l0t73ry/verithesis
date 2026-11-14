import type { SnapshotRecord, ThesisResult } from '@verithesis/enclave-worker';

const DB_NAME = 'verithesis-runs';
const DB_VERSION = 1;
const STORE = 'runs';
const MAX_LOCAL = 50;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'output_hash' });
        store.createIndex('saved_at', 'saved_at');
        store.createIndex('input_hash', 'input_hash');
      }
    };
  });
}

type StoredRun = {
  output_hash: string;
  input_hash: string;
  saved_at: string;
  result: ThesisResult;
};

function rowFromResult(result: ThesisResult): StoredRun {
  return {
    output_hash: result.attestation.output_hash,
    input_hash: result.attestation.input_hash,
    saved_at: result.attestation.execution_timestamp,
    result,
  };
}

export async function putLocalRun(result: ThesisResult): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(rowFromResult(result));
    });
    await trimLocalRuns(db);
  } finally {
    db.close();
  }
}

async function trimLocalRuns(db: IDBDatabase) {
  const rows = await listStoredRows(db);
  if (rows.length <= MAX_LOCAL) return;
  rows.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  const drop = rows.slice(MAX_LOCAL);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    for (const row of drop) store.delete(row.output_hash);
  });
}

function listStoredRows(db: IDBDatabase): Promise<StoredRun[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredRun[]);
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalSnapshots(): Promise<SnapshotRecord[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openDb();
  try {
    const rows = await listStoredRows(db);
    rows.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
    return rows.slice(0, MAX_LOCAL).map((row) => {
      const r = row.result;
      const snap = r.snapshot;
      if (snap) return snap;
      return {
        id: `${row.saved_at}-${row.output_hash.slice(0, 8)}`,
        saved_at: row.saved_at,
        input_hash: row.input_hash,
        output_hash: row.output_hash,
        signal: r.conclusion.signal,
        headline: r.conclusion.headline,
        timeframe: r.input.timeframe,
        target_token: r.input.target_token,
      };
    });
  } finally {
    db.close();
  }
}

function matchHash(stored: string, ref: string) {
  const a = stored.toLowerCase();
  const b = ref.trim().toLowerCase();
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export async function findLocalRun(ref: string): Promise<ThesisResult | null> {
  if (typeof indexedDB === 'undefined' || !ref.trim()) return null;
  const db = await openDb();
  try {
    const rows = await listStoredRows(db);
    const out = rows.find((r) => matchHash(r.output_hash, ref));
    if (out) return out.result;
    const byInput = rows.filter((r) => matchHash(r.input_hash, ref));
    if (byInput.length === 0) return null;
    byInput.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
    return byInput[0]!.result;
  } finally {
    db.close();
  }
}

export function mergeSnapshotLists(server: SnapshotRecord[], local: SnapshotRecord[]): SnapshotRecord[] {
  const map = new Map<string, SnapshotRecord>();
  for (const s of server) map.set(s.output_hash, s);
  for (const s of local) {
    if (!map.has(s.output_hash)) map.set(s.output_hash, s);
  }
  return [...map.values()].sort((a, b) => b.saved_at.localeCompare(a.saved_at)).slice(0, 50);
}
