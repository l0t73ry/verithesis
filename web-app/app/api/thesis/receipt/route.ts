import { buildRunReceipt } from '@verithesis/enclave-worker';
import { findRunByHash, findRunReceipt } from '@/lib/run-archive';
import { normalizeRunRef } from '@/lib/run-ref';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get('run')?.trim() ?? url.searchParams.get('hash')?.trim();
    if (!raw) {
      return Response.json({ error: 'run query required (output_hash)' }, { status: 400 });
    }
    const run = normalizeRunRef(raw);
    if (!run) return Response.json({ error: 'run must be 8–64 hex characters' }, { status: 400 });

    const stored = findRunByHash(run);
    if (!stored) {
      return Response.json({ found: false, run }, { status: 404 });
    }

    const receipt = findRunReceipt(stored.attestation.output_hash) ?? buildRunReceipt(stored);

    return Response.json({ found: true, receipt });
  } catch (e) {
    console.error('[verithesis] receipt failed:', e);
    return Response.json({ error: 'receipt failed' }, { status: 500 });
  }
}
