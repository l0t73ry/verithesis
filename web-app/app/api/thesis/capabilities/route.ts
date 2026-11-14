import { isOutLayerConfigured, wasmArtifactAvailable } from '@verithesis/enclave-worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const outlayer = isOutLayerConfigured();
  const wasm = wasmArtifactAvailable();
  return Response.json({
    tee: {
      outlayer,
      wasm,
      /** UI may show the enclave switch when wasm or OutLayer is available. */
      available: outlayer || wasm,
    },
    code_measurement:
      process.env.VERITHESIS_CODE_MEASUREMENT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
