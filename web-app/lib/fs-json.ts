import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

/** Write via temp file + rename so a crash can never leave a half-written JSON file behind. */
export function writeFileAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, data, 'utf8');
    renameSync(tmp, path);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* tmp may not exist */
    }
    throw e;
  }
}

/** Parse a JSON file; a missing or corrupt file yields `fallback` (and logs) instead of a 500. */
export function readJsonSafe<T>(path: string, fallback: T): T {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    console.error(`[verithesis] cannot read ${path}:`, e);
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[verithesis] corrupt JSON in ${path}:`, e);
    return fallback;
  }
}
