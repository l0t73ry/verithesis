'use client';

import { App, ConfigProvider } from 'antd';
import { antdLocaleFor } from '@/lib/antd-locale';
import { verithesisTheme } from '@/lib/antd-theme';
import { useI18n } from '@/lib/i18n/context';

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  return (
    <ConfigProvider theme={verithesisTheme} locale={antdLocaleFor(locale)}>
      <App message={{ maxCount: 3 }}>{children}</App>
    </ConfigProvider>
  );
}
