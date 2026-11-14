import { planVaultExecution } from '@verithesis/enclave-worker';
import type { ThesisResult } from '@verithesis/enclave-worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** TEE vault stub — returns execution plan for OutLayer wallet integration (no on-chain tx). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { result?: ThesisResult };
    if (!body.result?.attestation?.input_hash) {
      return Response.json({ error: 'missing result' }, { status: 400 });
    }
    const plan = planVaultExecution(body.result);
    return Response.json({ plan });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
