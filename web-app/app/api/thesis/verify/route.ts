import { hashThesisInput, hashOutput, runThesisAnalysis } from '@verithesis/enclave-worker';
import { findRunByHash } from '@/lib/run-archive';
import { normalizeRunRef } from '@/lib/run-ref';
import { envLimit, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Upstream fetches (CoinGecko + DefiLlama + GitHub) plus the WASM gate can exceed Vercel's 10s default.
export const maxDuration = 30;

const VERIFY_LIMIT_PER_MIN = envLimit('VERITHESIS_RATE_LIMIT_VERIFY_PER_MIN', 10);

const INVALID_REF = 'run / hash must be 8–64 hex characters';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const run = url.searchParams.get('run')?.trim();
    const hash = url.searchParams.get('hash')?.trim();
    const raw = run ?? hash;
    if (!raw) {
      return Response.json({ error: 'run (output_hash) or hash (input_hash) query required' }, { status: 400 });
    }
    const ref = normalizeRunRef(raw);
    if (!ref) return Response.json({ error: INVALID_REF }, { status: 400 });

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
  } catch (e) {
    console.error('[verithesis] verify GET failed:', e);
    return Response.json({ error: 'verify failed' }, { status: 500 });
  }
}

/** Re-run with archived input and compare output_hash (live APIs may drift on newest candle). */
export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, 'verify', VERIFY_LIMIT_PER_MIN);
    if (limited) return limited;

    const body = (await req.json()) as { hash?: unknown; run?: unknown; tee?: unknown };
    const ref = normalizeRunRef(body.run ?? body.hash);
    if (!ref) return Response.json({ error: INVALID_REF }, { status: 400 });

    const stored = findRunByHash(ref);
    if (!stored) return Response.json({ found: false, ref }, { status: 404 });

    const input = { ...stored.input, payment_receipt: stored.input.payment_receipt ?? null };
    const fresh = await runThesisAnalysis(input, { tee: body.tee === true });
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
