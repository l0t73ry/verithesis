'use client';

import { Card, Checkbox, Empty, Flex, Typography } from 'antd';
import type { SnapshotRecord } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';

const SNAP_CARD_WIDTH = 156;

export function SnapshotTimeline({
  snapshots,
  selectedId,
  compareIds,
  loading,
  onSelect,
  onToggleCompare,
}: {
  snapshots: SnapshotRecord[];
  selectedId?: string;
  compareIds: string[];
  loading?: boolean;
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
}) {
  const { t } = useI18n();

  if (!snapshots.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('snapshots.empty')} />;
  }

  return (
    <Flex gap={10} className="vt-snap-scroller" style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
      {snapshots.map((s) => {
        const active = selectedId === s.id;
        const inCompare = compareIds.includes(s.id);
        return (
          <Card
            key={s.id}
            size="small"
            hoverable
            onClick={() => onSelect(s.id)}
            style={{
              width: SNAP_CARD_WIDTH,
              flexShrink: 0,
              cursor: 'pointer',
              borderColor: active ? 'rgba(0, 230, 184, 0.5)' : inCompare ? 'rgba(129, 140, 248, 0.45)' : undefined,
            }}
          >
            <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
              <Typography.Text type="secondary" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                {s.saved_at.slice(0, 10)}
              </Typography.Text>
              <Checkbox
                checked={inCompare}
                aria-label={t('snapshots.compareToggle')}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleCompare(s.id)}
              />
            </Flex>
            <Typography.Text strong style={{ display: 'block', fontSize: 14 }}>
              {t(`signal.${s.signal}` as 'signal.bullish')}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {s.timeframe} · {s.target_token}
            </Typography.Text>
          </Card>
        );
      })}
    </Flex>
  );
}
