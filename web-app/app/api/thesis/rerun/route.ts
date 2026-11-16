import {
  parseThesisInput,
  runThesisAnalysis,
  runThesisAnalysisFromSnapshot,
} from '@verithesis/enclave-worker';
import type { ThesisInput } from '@verithesis/enclave-worker';
import { archiveRunToHub, fetchLatestHubSnapshot } from '@/lib/ghostore-hub';
import { archiveRun } from '@/lib/run-archive';
import { isPaymentReceiptValid } from '@/lib/payment';
import { envLimit, rateLimit } from '@/lib/rate-limit';
import { appendSnapshot } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const RERUN_LIMIT_PER_MIN = envLimit('VERITHESIS_RATE_LIMIT_RERUN_PER_MIN', 20);
const TEE_LIMIT_PER_MIN = envLimit('VERITHESIS_RATE_LIMIT_TEE_PER_MIN', 6);

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  const t = h.slice(7).trim();
  return t || null;
}

function requireAuth(): boolean {
  return process.env.VERITHESIS_REQUIRE_AUTH !== '0';
}

function snapshotOnly(): boolean {
  return process.env.VERITHESIS_SNAPSHOT_ONLY !== '0';
}

function parseBody(body: unknown): ThesisInput & { tee: boolean } {
  const params = parseThesisInput(body);
  const o = body as Record<string, unknown>;
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
    const hubToken = bearerToken(req);
    if (requireAuth() && !hubToken) {
      return Response.json({ error: 'Login required', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

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
    const baseInput: ThesisInput = { ...input, code_measurement };

    let result;
    if (snapshotOnly()) {
      const snap = await fetchLatestHubSnapshot();
      if (!snap) {
        return Response.json(
          { error: 'No market snapshot on Hub. Run ingest cron first.', code: 'SNAPSHOT_MISSING' },
          { status: 503 },
        );
      }
      const fetchedAt =
        typeof snap.fetched_at === 'string'
          ? snap.fetched_at
          : new Date(snap.fetched_at as unknown as string).toISOString();
      const hubSnap = { ...snap, fetched_at: fetchedAt };
      result = await runThesisAnalysisFromSnapshot(
        { ...baseInput, data_snapshot_id: snap.id },
        hubSnap,
        { tee },
      );
    } else {
      result = await runThesisAnalysis(baseInput, { tee });
    }

    archiveRun(result);
    if (hubToken) {
      const hub = await archiveRunToHub(result, hubToken, 'public');
      if (!hub.ok) console.warn('[verithesis] hub archive failed:', hub.error);
    }
    if (result.snapshot) appendSnapshot(result.snapshot);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}