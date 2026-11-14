import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import ruRU from 'antd/locale/ru_RU';
import zhCN from 'antd/locale/zh_CN';
import type { Locale } from '@/lib/i18n/locales';

export function antdLocaleFor(locale: Locale) {
  switch (locale) {
    case 'zh':
      return zhCN;
    case 'ja':
      return jaJP;
    case 'ru':
      return ruRU;
    default:
      return enUS;
  }
}
