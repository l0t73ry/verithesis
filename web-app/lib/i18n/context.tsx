'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { catalogs, type Messages } from './catalog';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

const STORAGE_KEY = 'verithesis-locale';

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isLocale(saved)) setLocaleState(saved);
    else {
      const nav = navigator.language.toLowerCase();
      if (nav.startsWith('zh')) setLocaleState('zh');
      else if (nav.startsWith('ja')) setLocaleState('ja');
      else if (nav.startsWith('ru')) setLocaleState('ru');
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
  }, [locale]);

  const messages = catalogs[locale];

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      let text =
        getByPath(messages as Record<string, unknown>, key) ??
        getByPath(catalogs.en as Record<string, unknown>, key) ??
        key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${k}}`, v);
        }
      }
      return text;
    },
    [messages],
  );

  const value = useMemo(() => ({ locale, setLocale, t, messages }), [locale, setLocale, t, messages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
