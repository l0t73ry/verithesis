import type { ThesisResult } from '@verithesis/enclave-worker';
import { findLocalRun } from '@/lib/run-indexeddb';

export async function fetchArchivedRun(ref: string, mode: 'run' | 'hash' = 'run'): Promise<ThesisResult | null> {
  const q = mode === 'run' ? `run=${encodeURIComponent(ref)}` : `hash=${encodeURIComponent(ref)}`;
  try {
    const res = await fetch(`/api/thesis/verify?${q}`);
    if (res.ok) {
      const data = await res.json();
      if (data.result) return data.result as ThesisResult;
    }
  } catch {
    /* fall through */
  }
  return findLocalRun(ref);
}
