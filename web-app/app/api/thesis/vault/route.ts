import { planVaultExecution } from '@verithesis/enclave-worker';
import { findRunByHash } from '@/lib/run-archive';
import { isFullHash } from '@/lib/run-ref';
import { archiveVaultPlanToHub, fetchLatestHubOfficialSignal, fetchVaultHubContext } from '@/lib/ghostore-hub';
import { fetchPublicRunFromHub } from '@/lib/ghostore-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  const t = h.slice(7).trim();
  return t || null;
}

function requireAuth(): boolean {
  return process.env.VERITHESIS_REQUIRE_AUTH !== '0';
}

async function loadStoredRun(outputHash: string, token: string | null) {
  let stored = findRunByHash(outputHash);
  if ((!stored || stored.attestation.output_hash !== outputHash) && token) {
    const hubRun = await fetchPublicRunFromHub(outputHash);
    if (hubRun?.attestation?.output_hash === outputHash) stored = hubRun;
  }
  return stored;
}

export async function POST(req: Request) {
  try {
    const token = bearerToken(req);
    if (requireAuth() && !token) {
      return Response.json({ error: 'login required', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const body = (await req.json()) as { output_hash?: unknown };
    if (!isFullHash(body?.output_hash)) {
      return Response.json({ error: 'output_hash (64 hex) required' }, { status: 400 });
    }

    const stored = await loadStoredRun(body.output_hash, token);
    if (!stored || stored.attestation.output_hash !== body.output_hash) {
      return Response.json({ error: 'run not found on server — re-run the analysis first' }, { status: 404 });
    }

    let official_signal = (await fetchLatestHubOfficialSignal())?.signal ?? null;
    let vault_trades_today = 0;
    if (token) {
      const ctx = await fetchVaultHubContext(token);
      if (ctx) {
        official_signal = ctx.official_signal ?? official_signal;
        vault_trades_today = ctx.vault_trades_today;
      }
    }

    const plan = planVaultExecution(stored, {
      official_signal,
      vault_trades_today,
    });

    if (token && plan.status === 'planned') {
      await archiveVaultPlanToHub(token, body.output_hash, plan);
    }

    return Response.json({ plan, hub: { official_signal, vault_trades_today } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}