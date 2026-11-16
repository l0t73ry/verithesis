import { parseThesisInput, runThesisAnalysis } from '@verithesis/enclave-worker';
import type { ThesisInput } from '@verithesis/enclave-worker';
import { archiveRunToHub } from '@/lib/ghostore-hub';
import { archiveRun } from '@/lib/run-archive';
import { isPaymentReceiptValid } from '@/lib/payment';
import { envLimit, rateLimit } from '@/lib/rate-limit';
import { appendSnapshot } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Upstream fetches (CoinGecko + DefiLlama + GitHub) plus the WASM gate can exceed Vercel's 10s default.
export const maxDuration = 30;

const RERUN_LIMIT_PER_MIN = envLimit('VERITHESIS_RATE_LIMIT_RERUN_PER_MIN', 20);
// TEE runs spend the server's paid OutLayer key / WASM CPU — keep them on a tighter budget.
const TEE_LIMIT_PER_MIN = envLimit('VERITHESIS_RATE_LIMIT_TEE_PER_MIN', 6);

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  const t = h.slice(7).trim();
  return t || null;
}

function parseBody(body: unknown): ThesisInput & { tee: boolean } {
  const params = parseThesisInput(body);
  const o = body as Record<string, unknown>;
  // Realtime access is decided by the server from the receipt; `realtime_unlocked` in the body
  // is deliberately ignored.
  const payment_receipt = isPaymentReceiptValid(o.payment_receipt) ? o.payment_receipt : null;
  return {
    ...params,
    realtime_unlocked: payment_receipt !== null,
    payment_receipt,
    tee: o.tee === true,
  };
}

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, 'rerun', RERUN_LIMIT_PER_MIN);
    if (limited) return limited;

    const body = await req.json();
    const parsed = parseBody(body);
    const { tee, ...input } = parsed;
    if (tee) {
      const teeLimited = rateLimit(req, 'rerun-tee', TEE_LIMIT_PER_MIN);
      if (teeLimited) return teeLimited;
    }

    const code_measurement =
      process.env.VERITHESIS_CODE_MEASUREMENT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;
    const result = await runThesisAnalysis({ ...input, code_measurement }, { tee });
    archiveRun(result);
    const hubToken = bearerToken(req);
    if (hubToken) {
      const hub = await archiveRunToHub(result, hubToken, 'public');
      if (!hub.ok) {
        console.warn('[verithesis] hub archive failed:', hub.error);
      }
    }
    if (result.snapshot) appendSnapshot(result.snapshot);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
