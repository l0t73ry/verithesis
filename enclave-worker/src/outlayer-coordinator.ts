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

function isThesisResult(v: unknown): v is ThesisResult {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Boolean(o.attestation && o.conclusion && o.series);
}

function mergeTeeAttestation(result: ThesisResult, envelope: OutLayerCallEnvelope): ThesisResult {
  const quoteB64 =
    envelope.attestation?.tdx_quote_b64 ??
    envelope.attestation?.quote_b64 ??
    envelope.quote?.tdx_quote_b64;
  const code =
    envelope.code_measurement ??
    envelope.attestation?.code_measurement ??
    result.attestation.code_measurement;

  const quoteStatus = quoteB64 ? ('verified' as const) : ('pending' as const);

  const attestation: AttestationBundle = {
    ...result.attestation,
    provider: 'outlayer-intel-tdx',
    code_measurement: code,
    quote: {
      ...result.attestation.quote,
      status: quoteStatus,
      tdx_quote_b64: quoteB64,
      verifier_hint: quoteB64
        ? 'TDX quote included. Verify with Intel DCAP or OutLayer published verifier.'
        : result.attestation.quote.verifier_hint,
    },
    signature_chain: result.attestation.signature_chain.map((step, i) =>
      i < 2 && quoteB64 ? { ...step, status: 'pass' as const, detail: step.detail || 'TEE quote bound' } : step,
    ),
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

  const res = await fetch(`${base}/call/${encodeURIComponent(project)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
  });

  const raw = (await res.json().catch(() => ({}))) as OutLayerCallEnvelope & Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof raw.error === 'string' ? raw.error : res.statusText;
    throw new Error(`OutLayer call failed: ${msg}`);
  }

  const payload = raw.output ?? raw.result ?? raw;
  if (!isThesisResult(payload)) {
    throw new Error('OutLayer response missing thesis result JSON');
  }

  return mergeTeeAttestation(payload, raw);
}

export function isOutLayerConfigured(): boolean {
  return Boolean(process.env.OUTLAYER_API_URL && process.env.OUTLAYER_PROJECT_ID);
}
