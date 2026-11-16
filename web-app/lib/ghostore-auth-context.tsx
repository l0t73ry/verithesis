'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GhostoreQuota } from '@/lib/ghostore-hub';
import {
  type GhostoreSession,
  loadGhostoreSession,
  loginGhostore,
  logoutGhostore,
  refreshGhostoreSession,
} from '@/lib/ghostore-auth';

async function fetchQuotaClient(token: string): Promise<GhostoreQuota | null> {
  try {
    const res = await fetch('/api/ghostore/quota', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: GhostoreQuota };
    return body.data ?? null;
  } catch {
    return null;
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
  const [session, setSession] = useState<GhostoreSession | null>(null);
  const [quota, setQuota] = useState<GhostoreQuota | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    setSession(loadGhostoreSession());
  }, []);

  const refreshQuota = useCallback(async () => {
    const s = loadGhostoreSession();
    if (!s) {
      setQuota(null);
      return;
    }
    let active = s;
    try {
      active = await refreshGhostoreSession(s);
      setSession(active);
    } catch {
      logoutGhostore();
      setSession(null);
      setQuota(null);
      return;
    }
    const q = await fetchQuotaClient(active.accessToken);
    setQuota(q);
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