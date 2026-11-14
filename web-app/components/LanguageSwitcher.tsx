'use client';

import { Select, Space, Typography } from 'antd';
import { useI18n } from '@/lib/i18n/context';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/locales';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <Space size={8} align="center">
      <Typography.Text type="secondary" className="hidden sm:inline" style={{ fontSize: 12 }}>
        {t('lang.label')}
      </Typography.Text>
      <Select<Locale>
        size="middle"
        value={locale}
        onChange={setLocale}
        aria-label={t('lang.label')}
        popupMatchSelectWidth={false}
        options={LOCALES.map((loc) => ({ value: loc, label: LOCALE_LABELS[loc] }))}
        style={{ width: 116 }}
      />
    </Space>
  );
}
