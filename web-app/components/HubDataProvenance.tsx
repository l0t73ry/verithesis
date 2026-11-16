'use client';

import { Tag, Typography } from 'antd';
import type { ThesisResult } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';

export function HubDataProvenance({ result }: { result: ThesisResult }) {
  const { t } = useI18n();
  const id = result.input.data_snapshot_id;
  const meta = result.hub_snapshot;
  if (id == null && !meta) return null;

  const fetched = meta?.fetched_at?.replace(/\.\d{3}Z$/, 'Z') ?? null;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {t('product.hubData', {
        id: String(id ?? meta?.id ?? '—'),
        at: fetched ? fetched.replace('T', ' ').slice(0, 19) : '—',
      })}{' '}
      <Tag variant="filled" color="blue" style={{ fontSize: 11, marginInlineStart: 4 }}>
        Ghostore Hub
      </Tag>
    </Typography.Text>
  );
}