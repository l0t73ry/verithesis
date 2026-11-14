import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where runs / snapshots are persisted. Vercel's deployment dir is read-only, so use tmp there. */
export function resolveDataDir(): string {
  if (process.env.VERITHESIS_DATA_DIR) return process.env.VERITHESIS_DATA_DIR;
  if (process.env.VERCEL || process.cwd().startsWith('/var/task')) {
    return join(tmpdir(), 'verithesis-data');
  }
  return join(process.cwd(), '.data');
}
