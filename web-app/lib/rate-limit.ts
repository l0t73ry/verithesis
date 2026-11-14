type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 5_000;

function clientKey(req: Request): string {
  // First hop of X-Forwarded-For (set by the platform proxy); 'local' when running bare.
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || 'local';
}

/**
 * Fixed-window, in-memory limiter (per server instance — enough to blunt a single abusive client
 * hammering upstream APIs / the paid OutLayer key; put a real gateway in front for more).
 * Returns a 429 Response when over the limit, otherwise null.
 */
export function rateLimit(req: Request, scope: string, limitPerMin: number, now = Date.now()): Response | null {
  if (limitPerMin <= 0) return null;
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }
  const key = `${scope}:${clientKey(req)}`;
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  b.count += 1;
  if (b.count <= limitPerMin) return null;
  const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return Response.json(
    { error: 'Too many requests, slow down.' },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  );
}

export function envLimit(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export function resetRateLimitForTests() {
  buckets.clear();
}
