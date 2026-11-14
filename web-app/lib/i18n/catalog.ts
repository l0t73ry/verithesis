import en from './messages/en.json';
import ja from './messages/ja.json';
import ru from './messages/ru.json';
import zh from './messages/zh.json';
import type { Locale } from './locales';

export type Messages = typeof en;

export const catalogs: Record<Locale, Messages> = { en, zh, ja, ru };

export function getParseApiMessages(locale: Locale) {
  return catalogs[locale].parseApi;
}
