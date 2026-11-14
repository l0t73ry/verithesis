/** Smallest accepted hash prefix; shorter refs would match arbitrary runs. */
export const MIN_REF_LEN = 8;
const REF_RE = /^[0-9a-f]{8,64}$/;
const FULL_HASH_RE = /^[0-9a-f]{64}$/;

/**
 * Normalise a user-supplied run reference (output_hash / input_hash, full or prefix).
 * Returns null unless it is 8–64 lowercase hex chars — this is the only gate between request
 * parameters and archive file names, so it must stay strict (no `/`, `.`, `\`).
 */
export function normalizeRunRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const h = ref.trim().toLowerCase();
  return REF_RE.test(h) ? h : null;
}

export function isFullHash(h: unknown): h is string {
  return typeof h === 'string' && FULL_HASH_RE.test(h);
}

/** `stored` starts with `ref` (one direction only: a longer, tampered ref must not match). */
export function refMatches(stored: string, ref: string): boolean {
  return ref.length >= MIN_REF_LEN && stored.toLowerCase().startsWith(ref.toLowerCase());
}
