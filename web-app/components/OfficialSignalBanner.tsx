'use client';

import { useEffect, useState } from 'react';
import { Alert, Spin, Tag, Typography } from 'antd';
import { useI18n } from '@/lib/i18n/context';
import { signalVisual } from '@/lib/signal-visual';

type OfficialSignalPayload = {
  signal: 'bullish' | 'bearish' | 'neutral';
  suggested_action: 'hold' | 'watch_long_bias' | 'defensive';
  data_snapshot_id?: number;
  hub_snapshot_fetched_at?: string | null;
  pearson_r: number;
  recent_mom_pct: string;
  triggers: string[];
  input: { timeframe: string; target_token: string };
};

export function OfficialSignalBanner() {
  const { t } = useI18n();
  const [data, setData] = useState<OfficialSignalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/thesis/signal/latest', { cache: 'no-store' });
        const body = (await res.json()) as { data?: OfficialSignalPayload; error?: string };
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (!cancelled) setData(body.data ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('dashboard.requestFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <Alert
        type="info"
        showIcon
        title={t('official.loading')}
        description={<Spin size="small" />}
        style={{ marginBottom: 12 }}
      />
    );
  }

  if (error || !data) {
    return (
      <Alert type="warning" showIcon title={t('official.unavailable')} description={error ?? '—'} style={{ marginBottom: 12 }} />
    );
  }

  const visual = signalVisual(data.signal);
  const at = data.hub_snapshot_fetched_at?.replace('T', ' ').slice(0, 19) ?? '—';

  return (
    <Alert
      type="info"
      showIcon={false}
      title={
        <Typography.Text strong>
          {t('official.title', { token: data.input.target_token, tf: data.input.timeframe })}
        </Typography.Text>
      }
      description={
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          <Tag color={visual.color} style={{ marginRight: 8 }}>
            {t(`signal.${data.signal}` as 'signal.bullish')}
          </Tag>
          <Tag>{t(`official.action.${data.suggested_action}` as 'official.action.hold')}</Tag>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
            {t('official.meta', {
              id: String(data.data_snapshot_id ?? '—'),
              at,
              r: String(data.pearson_r),
              mom: data.recent_mom_pct,
            })}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {t('official.hint')}
          </Typography.Text>
        </div>
      }
      style={{ marginBottom: 12, borderColor: visual.border, background: visual.bg }}
    />
  );
}