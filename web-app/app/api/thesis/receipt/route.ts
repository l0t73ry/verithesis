import { buildRunReceipt } from '@verithesis/enclave-worker';
import { findRunByHash, findRunReceipt } from '@/lib/run-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const run = url.searchParams.get('run')?.trim() ?? url.searchParams.get('hash')?.trim();
  if (!run) {
    return Response.json({ error: 'run query required (output_hash)' }, { status: 400 });
  }

  const stored = findRunByHash(run);
  if (!stored) {
    return Response.json({ found: false, run }, { status: 404 });
  }

  const receipt = findRunReceipt(stored.attestation.output_hash) ?? buildRunReceipt(stored);

  return Response.json({ found: true, receipt });
}
