'use client';

import type { SeriesPoint } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';
import { ThesisChartView } from './ThesisChartView';

export default function ThesisChartInner({ series, height }: { series: SeriesPoint[]; height: number }) {
  const { t } = useI18n();
  return (
    <ThesisChartView
      series={series}
      height={height}
      priceLabel={t('chart.price')}
      tvlLabel={t('chart.tvl')}
    />
  );
}
