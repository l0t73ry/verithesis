import { runThesisAnalysisFromSnapshot } from '@verithesis/enclave-worker';
import { buildOfficialSignalView, officialThesisInputFromEnv } from '@/lib/official-signal';
import { fetchLatestHubOfficialSignal, fetchLatestHubSnapshot } from '@/lib/ghostore-hub';
import { envLimit, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const SIGNAL_LIMIT = envLimit('VERITHESIS_RATE_LIMIT_SIGNAL_PER_MIN', 60);

function snapshotOnly(): boolean {
  return process.env.VERITHESIS_SNAPSHOT_ONLY !== '0';
}

async function recomputeOfficialSignal() {
  const snap = await fetchLatestHubSnapshot();
  if (!snap) return null;

  const fetchedAt =
    typeof snap.fetched_at === 'string'
      ? snap.fetched_at
      : new Date(snap.fetched_at as unknown as string).toISOString();
  const hubSnap = { ...snap, fetched_at: fetchedAt };

  const baseInput = officialThesisInputFromEnv();
  const code_measurement =
    process.env.VERITHESIS_CODE_MEASUREMENT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

  const result = await runThesisAnalysisFromSnapshot(
    { ...baseInput, code_measurement, data_snapshot_id: snap.id },
    hubSnap,
    {},
  );
  result.hub_snapshot = { id: hubSnap.id, fetched_at: hubSnap.fetched_at, status: hubSnap.status };

  return {
    source: 'recomputed' as const,
    data: buildOfficialSignalView(result),
  };
}

export async function GET(req: Request) {
  const limited = rateLimit(req, 'signal-latest', SIGNAL_LIMIT);
  if (limited) return limited;

  if (!snapshotOnly()) {
    return Response.json(
      { error: 'Official signal requires VERITHESIS_SNAPSHOT_ONLY=1', code: 'SNAPSHOT_ONLY_REQUIRED' },
      { status: 503 },
    );
  }

  const persisted = await fetchLatestHubOfficialSignal();
  if (persisted?.payload && typeof persisted.payload === 'object') {
    return Response.json({
      success: true,
      source: 'hub',
      data: persisted.payload,
    });
  }

  const rebuilt = await recomputeOfficialSignal();
  if (!rebuilt) {
    return Response.json({ error: 'No market snapshot on Hub', code: 'SNAPSHOT_MISSING' }, { status: 503 });
  }

  return Response.json({ success: true, ...rebuilt });
}