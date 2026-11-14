'use client';

import { Table, Typography } from 'antd';
import type { CompareRun } from './ThesisCompareChart';
import { useI18n } from '@/lib/i18n/context';

export function ThesisCompareMetricsTable({ runs }: { runs: CompareRun[] }) {
  const { t } = useI18n();
  if (runs.length < 2) return null;

  const columns = [
    {
      title: t('snapshots.colTime'),
      dataIndex: 'savedAt',
      key: 'savedAt',
      width: 96,
      render: (v: string) => (
        <Typography.Text style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{v}</Typography.Text>
      ),
    },
    {
      title: t('snapshots.colConfig'),
      dataIndex: 'config',
      key: 'config',
      width: 88,
    },
    {
      title: t('dashboard.signal'),
      dataIndex: 'signal',
      key: 'signal',
      width: 72,
    },
    {
      title: t('dashboard.metricsR'),
      dataIndex: 'metrics',
      key: 'metrics',
      width: 108,
      render: (v: string) => (
        <Typography.Text style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{v}</Typography.Text>
      ),
    },
    {
      title: t('dashboard.hitRate'),
      dataIndex: 'hit',
      key: 'hit',
      width: 72,
    },
    {
      title: t('dashboard.sharpe'),
      dataIndex: 'sharpe',
      key: 'sharpe',
      width: 64,
    },
    {
      title: t('dashboard.strategyReturn'),
      dataIndex: 'strat',
      key: 'strat',
      width: 80,
    },
    {
      title: t('snapshots.colHash'),
      dataIndex: 'hash',
      key: 'hash',
      render: (v: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          {v}
        </Typography.Text>
      ),
    },
  ];

  const dataSource = runs.map((r) => ({
    key: r.id,
    savedAt: r.savedAt.slice(0, 16).replace('T', ' '),
    config: `${r.timeframe} · ${r.targetToken} · ${r.smoothing}d`,
    signal: t(`signal.${r.conclusion.signal}` as 'signal.bullish'),
    metrics: `${r.conclusion.pearson_r} / ${r.conclusion.r_squared}`,
    hit: `${r.conclusion.backtest_hit_rate}%`,
    sharpe: r.conclusion.sharpe_ratio ?? '—',
    strat: `${r.conclusion.strategy_return_pct ?? '—'}% / ${r.conclusion.buy_hold_return_pct ?? '—'}%`,
    hash: `${r.inputHash.slice(0, 8)}…`,
  }));

  return (
    <Table
      size="small"
      pagination={false}
      columns={columns}
      dataSource={dataSource}
      style={{ marginTop: 8 }}
      scroll={{ x: 520 }}
    />
  );
}
