import { hashThesisInput, hashOutput, runThesisAnalysis } from '@verithesis/enclave-worker';
import { findRunByHash } from '@/lib/run-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const run = url.searchParams.get('run')?.trim();
  const hash = url.searchParams.get('hash')?.trim();
  const ref = run ?? hash;
  if (!ref) {
    return Response.json({ error: 'run (output_hash) or hash (input_hash) query required' }, { status: 400 });
  }

  const stored = findRunByHash(ref);
  if (!stored) {
    return Response.json({ found: false, ref }, { status: 404 });
  }

  return Response.json({
    found: true,
    hash: stored.attestation.input_hash,
    output_hash: stored.attestation.output_hash,
    saved_at: stored.attestation.execution_timestamp,
    result: stored,
    lookup: run ? 'output_hash' : 'input_hash',
  });
}

/** Re-run with archived input and compare output_hash (live APIs may drift on newest candle). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { hash?: string; run?: string; tee?: boolean };
    const ref = (body.run ?? body.hash)?.trim();
    if (!ref) return Response.json({ error: 'run or hash required' }, { status: 400 });

    const stored = findRunByHash(ref);
    if (!stored) return Response.json({ found: false, ref }, { status: 404 });

    const input = { ...stored.input, payment_receipt: stored.input.payment_receipt ?? null };
    const fresh = await runThesisAnalysis(input, { tee: Boolean(body.tee) });
    const recomputedIn = hashThesisInput(input);
    const recomputedOut = hashOutput({ series: fresh.series, conclusion: fresh.conclusion });

    const inputMatch = recomputedIn === stored.attestation.input_hash;
    const outputMatch = recomputedOut === stored.attestation.output_hash;

    return Response.json({
      found: true,
      input_match: inputMatch,
      output_match: outputMatch,
      expected: {
        input_hash: stored.attestation.input_hash,
        output_hash: stored.attestation.output_hash,
      },
      recomputed: {
        input_hash: recomputedIn,
        output_hash: recomputedOut,
      },
      attestation: fresh.attestation,
      note: outputMatch
        ? 'Output hash matches archived run.'
        : 'Output hash differs — check live data window or enclave provider.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
