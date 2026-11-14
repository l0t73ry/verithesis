import { SHA256_HEX_RE, hashOutput, hashThesisInput } from './hash';
import { fetchWithTimeout } from './http';
import type { AttestationBundle, ThesisInput, ThesisResult } from './types';

export type OutLayerCallEnvelope = {
  output?: ThesisResult;
  result?: ThesisResult;
  attestation?: Partial<AttestationBundle> & {
    tdx_quote_b64?: string;
    quote_b64?: string;
  };
  quote?: { tdx_quote_b64?: string; status?: string };
  code_measurement?: string;
};

const OUTLAYER_TIMEOUT_MS = Number.parseInt(process.env.OUTLAYER_TIMEOUT_MS ?? '60000', 10) || 60_000;
const MAX_ERROR_LEN = 200;

function isThesisResult(v: unknown): v is ThesisResult {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Boolean(o.attestation && o.conclusion && Array.isArray(o.series));
}

/**
 * The coordinator is a remote, untrusted party: re-derive both hashes locally and require them
 * to match what it claims, and to match the input *we* sent. Also guarantees the hashes are
 * plain hex (they are later used as archive file names).
 */
function assertRemoteResultConsistent(result: ThesisResult, requested: ThesisInput) {
  const { input_hash, output_hash } = result.attestation;
  if (!SHA256_HEX_RE.test(input_hash ?? '') || !SHA256_HEX_RE.test(output_hash ?? '')) {
    throw new Error('OutLayer result has malformed attestation hashes');
  }
  if (hashThesisInput(requested) !== input_hash) {
    throw new Error('OutLayer result input_hash does not match the submitted input');
  }
  if (hashOutput({ series: result.series, conclusion: result.conclusion }) !== output_hash) {
    throw new Error('OutLayer result output_hash does not match its series/conclusion');
  }
}

/**
 * Attach the TDX quote when present. The quote is NOT verified here (no DCAP / report_data
 * binding yet), so status stays `pending` — never claim `verified` without a verifier.
 */
function mergeTeeAttestation(result: ThesisResult, envelope: OutLayerCallEnvelope): ThesisResult {
  const quoteB64 =
    envelope.attestation?.tdx_quote_b64 ??
    envelope.attestation?.quote_b64 ??
    envelope.quote?.tdx_quote_b64;
  const code =
    envelope.code_measurement ??
    envelope.attestation?.code_measurement ??
    result.attestation.code_measurement;

  const attestation: AttestationBundle = {
    ...result.attestation,
    provider: 'outlayer-intel-tdx',
    code_measurement: code,
    quote: {
      ...result.attestation.quote,
      status: 'pending',
      tdx_quote_b64: quoteB64,
      verifier_hint: quoteB64
        ? 'TDX quote attached but NOT verified by this server. Verify with Intel DCAP or the OutLayer published verifier (report_data must bind output_hash).'
        : result.attestation.quote.verifier_hint,
    },
  };

  return { ...result, attestation };
}

/** Call OutLayer HTTPS coordinator when env is configured (WASI P2 enclave). */
export async function callOutLayerThesis(input: ThesisInput): Promise<ThesisResult | null> {
  const base = process.env.OUTLAYER_API_URL?.replace(/\/$/, '');
  const project = process.env.OUTLAYER_PROJECT_ID;
  if (!base || !project) return null;

  const paymentKey = process.env.OUTLAYER_PAYMENT_KEY;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (paymentKey) headers['X-Payment-Key'] = paymentKey;

  const res = await fetchWithTimeout(
    `${base}/call/${encodeURIComponent(project)}`,
    { method: 'POST', headers, body: JSON.stringify({ input }) },
    OUTLAYER_TIMEOUT_MS,
  );

  const raw = (await res.json().catch(() => ({}))) as OutLayerCallEnvelope & Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof raw.error === 'string' ? raw.error : res.statusText;
    throw new Error(`OutLayer call failed: ${msg.slice(0, MAX_ERROR_LEN)}`);
  }

  const payload = raw.output ?? raw.result ?? raw;
  if (!isThesisResult(payload)) {
    throw new Error('OutLayer response missing thesis result JSON');
  }
  assertRemoteResultConsistent(payload, input);

  return mergeTeeAttestation(payload, raw);
}

export function isOutLayerConfigured(): boolean {
  return Boolean(process.env.OUTLAYER_API_URL && process.env.OUTLAYER_PROJECT_ID);
}
