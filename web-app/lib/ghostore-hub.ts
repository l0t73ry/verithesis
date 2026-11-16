import type { HubDataSnapshot, ThesisResult } from '@verithesis/enclave-worker';
import { ghostoreUpstreamBase, hubArchiveEnabled } from '@/lib/ghostore-upstream';

export function isHubArchiveEnabled(): boolean {
  return hubArchiveEnabled();
}

export async function fetchPublicRunFromHub(ref: string): Promise<ThesisResult | null> {
  if (!isHubArchiveEnabled()) return null;
  const base = ghostoreUpstreamBase();
  try {
    const res = await fetch(`${base}/api/verithesis/public/runs/${encodeURIComponent(ref)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: { result?: ThesisResult } };
    return body.data?.result ?? null;
  } catch {
    return null;
  }
}

export async function archiveRunToHub(
  result: ThesisResult,
  accessToken: string,
  visibility: 'public' | 'private' = 'public',
): Promise<{ ok: boolean; error?: string }> {
  if (!isHubArchiveEnabled()) return { ok: false, error: 'hub_disabled' };
  const base = ghostoreUpstreamBase();
  try {
    const res = await fetch(`${base}/api/verithesis/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ result, visibility }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string }; message?: string }).error?.message
        || (err as { message?: string }).message
        || res.statusText;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'hub_unreachable' };
  }
}

export type GhostoreQuota = {
  runs_today: number;
  runs_limit: number;
  remaining: number;
};

export async function fetchLatestHubSnapshot(): Promise<HubDataSnapshot | null> {
  const base = ghostoreUpstreamBase();
  try {
    const res = await fetch(`${base}/api/verithesis/snapshot/latest`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: HubDataSnapshot };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchHubQuota(accessToken: string): Promise<GhostoreQuota | null> {
  const base = ghostoreUpstreamBase();
  try {
    const res = await fetch(`${base}/api/verithesis/quota`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: GhostoreQuota };
    return body.data ?? null;
  } catch {
    return null;
  }
}