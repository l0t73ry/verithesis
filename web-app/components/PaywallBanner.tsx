'use client';

import { Alert, Button } from 'antd';
import { useI18n } from '@/lib/i18n/context';

export function PaywallBanner({
  lagged,
  onUnlock,
  unlocking,
}: {
  lagged: boolean;
  onUnlock: () => void;
  unlocking: boolean;
}) {
  const { t } = useI18n();

  if (!lagged) {
    return <Alert type="success" showIcon title={t('paywall.unlocked')} description={t('paywall.unlockedHint')} />;
  }

  return (
    <Alert
      type="warning"
      showIcon
      title={t('paywall.lagged')}
      description={t('paywall.demoNote')}
      action={
        <Button size="small" loading={unlocking} onClick={onUnlock}>
          {t('paywall.unlock')}
        </Button>
      }
    />
  );
}
