'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GhostoreQuota } from '@/lib/ghostore-hub';
import {
  type GhostoreSession,
  loadGhostoreSession,
  loginGhostore,
  logoutGhostore,
  refreshGhostoreSession,
} from '@/lib/ghostore-auth';

async function fetchQuotaClient(token: string): Promise<{ quota: GhostoreQuota | null; status: number }> {
  try {
    const res = await fetch('/api/ghostore/quota', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { quota: null, status: res.status };
    const body = (await res.json()) as { data?: GhostoreQuota };
    return { quota: body.data ?? null, status: res.status };
  } catch {
    return { quota: null, status: 0 };
  }
}

type Ctx = {
  session: GhostoreSession | null;
  quota: GhostoreQuota | null;
  loggingIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshQuota: () => Promise<void>;
};

const GhostoreAuthContext = createContext<Ctx | null>(null);

export function GhostoreAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GhostoreSession | null>(() =>
    typeof window === 'undefined' ? null : loadGhostoreSession(),
  );
  const [quota, setQuota] = useState<GhostoreQuota | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const refreshMutex = useRef<Promise<void> | null>(null);

  const refreshQuota = useCallback(async () => {
    if (refreshMutex.current) {
      await refreshMutex.current;
      return;
    }

    const job = (async () => {
      const s = loadGhostoreSession();
      if (!s) {
        setQuota(null);
        return;
      }
      let active = s;
      const first = await fetchQuotaClient(active.accessToken);
      if (first.status === 401) {
        try {
          active = await refreshGhostoreSession(active);
          setSession((prev) =>
            prev?.accessToken === active.accessToken && prev?.refreshToken === active.refreshToken ? prev : active,
          );
        } catch {
          logoutGhostore();
          setSession(null);
          setQuota(null);
          return;
        }
        const retry = await fetchQuotaClient(active.accessToken);
        setQuota(retry.quota);
        return;
      }
      setQuota(first.quota);
      setSession((prev) =>
        prev?.accessToken === active.accessToken && prev?.refreshToken === active.refreshToken ? prev : active,
      );
    })();

    refreshMutex.current = job;
    try {
      await job;
    } finally {
      refreshMutex.current = null;
    }
  }, []);

  useEffect(() => {
    if (session) void refreshQuota();
    else setQuota(null);
  }, [session, refreshQuota]);

  const login = useCallback(async (username: string, password: string) => {
    setLoggingIn(true);
    try {
      const s = await loginGhostore(username, password);
      setSession(s);
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    logoutGhostore();
    setSession(null);
    setQuota(null);
  }, []);

  const value = useMemo(
    () => ({ session, quota, loggingIn, login, logout, refreshQuota }),
    [session, quota, loggingIn, login, logout, refreshQuota],
  );

  return <GhostoreAuthContext.Provider value={value}>{children}</GhostoreAuthContext.Provider>;
}

export function useGhostoreAuth(): Ctx {
  const ctx = useContext(GhostoreAuthContext);
  if (!ctx) throw new Error('useGhostoreAuth must be used within GhostoreAuthProvider');
  return ctx;
}