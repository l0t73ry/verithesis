'use client';

import dynamic from 'next/dynamic';
import { Skeleton, Typography } from 'antd';
import type { SeriesPoint } from '@verithesis/enclave-worker';
import { THESIS_CHART_HEIGHT, THESIS_PLOT_HEIGHT } from '@/lib/thesis-chart-config';
import { useI18n } from '@/lib/i18n/context';

const CHART_HEIGHT = THESIS_CHART_HEIGHT;

const LineChartInner = dynamic(() => import('./ThesisChartInner'), {
  ssr: false,
  loading: () => <Skeleton active style={{ height: CHART_HEIGHT }} />,
});

export function ThesisChart({ series }: { series: SeriesPoint[] }) {
  const { t } = useI18n();

  return (
    <div>
      <Typography.Text strong>{t('chart.title')}</Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
        {t('chart.days', { n: String(series.length) })}
      </Typography.Text>
      <LineChartInner series={series} height={THESIS_PLOT_HEIGHT} />
    </div>
  );
}
