#!/usr/bin/env npx tsx
/**
 * Local OutLayer coordinator stub for hackathon / integration tests.
 * POST /call/:project with body `{ "input": ThesisInput }` → ThesisResult + mock TDX quote.
 *
 *   OUTLAYER_API_URL=http://127.0.0.1:8791 OUTLAYER_PROJECT_ID=demo.near/verithesis npm run mock:outlayer
 *   # In web-app/.env.local set the same + NEXT_PUBLIC_OUTLAYER_ENABLED=true
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { parseThesisInput, runThesisAnalysis, type ThesisInput } from '../enclave-worker/src/index.ts';
import { runThesisInLocalTee, wasmArtifactAvailable } from '../enclave-worker/src/local-tee.ts';

if (process.env.NODE_ENV === 'production') {
  console.error('mock OutLayer coordinator must not run in production');
  process.exit(1);
}

const PORT = Number.parseInt(process.env.MOCK_OUTLAYER_PORT ?? '8791', 10);
const PROJECT = process.env.MOCK_OUTLAYER_PROJECT_ID ?? 'demo.near/verithesis';
const MOCK_QUOTE = process.env.MOCK_TDX_QUOTE_B64 ?? 'bW9jay12ZXJpdGhlc2lzLXRkeC1xdW90ZQ==';

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      send(res, 200, { ok: true, project: PROJECT });
      return;
    }
    const m = req.url?.match(/^\/call\/(.+)$/);
    if (req.method === 'POST' && m) {
      const project = decodeURIComponent(m[1]!);
      if (project !== PROJECT) {
        send(res, 404, { error: `unknown project ${project}` });
        return;
      }
      const body = (await readJson(req)) as { input?: Record<string, unknown> };
      const input = body.input;
      if (!input || typeof input !== 'object') {
        send(res, 400, { error: 'missing input' });
        return;
      }
      // Same strict parsing as the web API. The mock has no payment backend, so it simply echoes the
      // already-server-decided unlock flag (it is part of input_hash); the measurement is never client-set.
      const thesisInput: ThesisInput = {
        ...parseThesisInput(input),
        realtime_unlocked: input.realtime_unlocked === true,
        payment_receipt: typeof input.payment_receipt === 'string' ? input.payment_receipt : null,
        code_measurement: 'mock-outlayer-coordinator',
      };
      const base = wasmArtifactAvailable()
        ? await runThesisInLocalTee(thesisInput)
        : await runThesisAnalysis(thesisInput, { tee: false });
      const result = {
        ...base,
        attestation: {
          ...base.attestation,
          provider: 'outlayer-intel-tdx' as const,
          quote: {
            ...base.attestation.quote,
            status: 'simulated' as const,
            tdx_quote_b64: MOCK_QUOTE,
            verifier_hint: 'Mock OutLayer coordinator (local). The quote is fake — replace with a hardware TDX quote in production.',
          },
        },
      };
      send(res, 200, {
        output: result,
        code_measurement: result.attestation.code_measurement,
        attestation: {
          tdx_quote_b64: MOCK_QUOTE,
          code_measurement: result.attestation.code_measurement,
        },
      });
      return;
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    send(res, 500, { error: message });
  }
}).listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`mock OutLayer coordinator http://127.0.0.1:${PORT}/call/${PROJECT}`);
});
