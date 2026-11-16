export const GHOSTORE_APP_ID = 'verithesis';

export type GhostoreSession = {
  accessToken: string;
  refreshToken: string;
  username: string;
};

const STORAGE_KEY = 'verithesis.ghostore.session';

export function loadGhostoreSession(): GhostoreSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as GhostoreSession;
    if (!o.accessToken || !o.refreshToken) return null;
    return o;
  } catch {
    return null;
  }
}

export function saveGhostoreSession(session: GhostoreSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function loginGhostore(username: string, password: string): Promise<GhostoreSession> {
  const res = await fetch('/api/ghostore/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string } }).error?.message
      || (body as { message?: string }).message
      || '登录失败';
    throw new Error(msg);
  }
  const data = (body as { data?: Record<string, unknown> }).data || {};
  const access = String(data.token || data.accessToken || data.access_token || '');
  const refresh = String(data.refreshToken || data.refresh_token || '');
  const user = (data.user as { username?: string } | undefined)?.username || username;
  if (!access || !refresh) throw new Error('登录响应缺少 token');
  const session: GhostoreSession = { accessToken: access, refreshToken: refresh, username: user };
  saveGhostoreSession(session);
  return session;
}

export async function refreshGhostoreSession(session: GhostoreSession): Promise<GhostoreSession> {
  const res = await fetch('/api/ghostore/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('会话已过期，请重新登录');
  const data = (body as { data?: Record<string, unknown> }).data || {};
  const access = String(data.token || data.accessToken || data.access_token || '');
  const refresh = String(data.refreshToken || data.refresh_token || session.refreshToken);
  if (!access) throw new Error('刷新失败');
  const next: GhostoreSession = { ...session, accessToken: access, refreshToken: refresh };
  saveGhostoreSession(next);
  return next;
}

export function logoutGhostore(): void {
  saveGhostoreSession(null);
}