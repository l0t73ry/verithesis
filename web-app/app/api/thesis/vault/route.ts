import { planVaultExecution } from '@verithesis/enclave-worker';
import { findRunByHash } from '@/lib/run-archive';
import { isFullHash } from '@/lib/run-ref';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * TEE vault stub — returns an execution plan for OutLayer wallet integration (no on-chain tx).
 * The plan is built from the server-side archived run for `output_hash`; a client-supplied
 * ThesisResult is never trusted, so a forged "bullish" payload cannot produce a plan.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { output_hash?: unknown };
    if (!isFullHash(body?.output_hash)) {
      return Response.json({ error: 'output_hash (64 hex) required' }, { status: 400 });
    }
    const stored = findRunByHash(body.output_hash);
    if (!stored || stored.attestation.output_hash !== body.output_hash) {
      return Response.json({ error: 'run not found on server — re-run the analysis first' }, { status: 404 });
    }
    return Response.json({ plan: planVaultExecution(stored) });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
