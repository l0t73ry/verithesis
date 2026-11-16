import { planVaultExecution } from '@verithesis/enclave-worker';
import { findRunByHash } from '@/lib/run-archive';
import { isFullHash } from '@/lib/run-ref';
import { archiveVaultPlanToHub, fetchLatestHubOfficialSignal, fetchVaultHubContext } from '@/lib/ghostore-hub';

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

/** 金库只信任本机归档（同实例 rerun）；不信任 Hub 公开 run，避免拿他人 hash 套计划。 */
function loadStoredRun(outputHash: string) {
  const stored = findRunByHash(outputHash);
  if (!stored || stored.attestation.output_hash !== outputHash) return null;
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

    const stored = loadStoredRun(body.output_hash);
    if (!stored || stored.attestation.output_hash !== body.output_hash) {
      return Response.json({ error: 'run not found on server — re-run the analysis first' }, { status: 404 });
    }

    let official_signal = (await fetchLatestHubOfficialSignal())?.signal ?? null;
    let vault_trades_today = 0;
    if (token) {
      const ctx = await fetchVaultHubContext(token);
      if (!ctx) {
        return Response.json(
          { error: 'Hub vault context unavailable', code: 'HUB_CONTEXT_FAILED' },
          { status: 503 },
        );
      }
      official_signal = ctx.official_signal ?? official_signal;
      vault_trades_today = ctx.vault_trades_today;
    }

    const plan = planVaultExecution(stored, {
      official_signal,
      vault_trades_today,
    });

    let hub_audit: { ok: boolean; error?: string } | null = null;
    if (token && plan.status === 'planned') {
      hub_audit = await archiveVaultPlanToHub(token, body.output_hash, plan);
      if (!hub_audit.ok) {
        return Response.json(
          {
            plan: { ...plan, status: 'rejected', reason: 'hub_audit_failed', dao_risk: plan.dao_risk },
            hub: { official_signal, vault_trades_today, audit_error: hub_audit.error },
            error: 'Hub 金库审计写入失败',
            code: 'HUB_AUDIT_FAILED',
          },
          { status: 503 },
        );
      }
    }

    return Response.json({ plan, hub: { official_signal, vault_trades_today, audit: hub_audit } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}