'use client';

import { Alert, Typography } from 'antd';
import { useI18n } from '@/lib/i18n/context';

export function ProductDisclosure({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  if (compact) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5, display: 'block' }}>
        {t('product.scopeShort')}
      </Typography.Text>
    );
  }
  return (
    <Alert
      type="info"
      showIcon
      title={t('product.scopeTitle')}
      description={
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
          <li>{t('product.scopeAnalysis')}</li>
          <li>{t('product.scopeSignal')}</li>
          <li>{t('product.scopeBacktest')}</li>
          <li>{t('product.scopeNotAdvice')}</li>
        </ul>
      }
      style={{ marginBottom: 0 }}
    />
  );
}