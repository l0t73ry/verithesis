'use client';

import dynamic from 'next/dynamic';
import { Alert, Skeleton, Typography } from 'antd';
import type { SeriesPoint, ThesisConclusion, TargetToken, Timeframe } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';
import { useMemo } from 'react';
import { ThesisCompareMetricsTable } from './ThesisCompareMetricsTable';

const CHART_HEIGHT = 220;

export type CompareRun = {
  id: string;
  label: string;
  color: string;
  series: SeriesPoint[];
  inputHash: string;
  outputHash: string;
  savedAt: string;
  timeframe: Timeframe;
  targetToken: TargetToken;
  smoothing: number;
  conclusion: ThesisConclusion;
};

const CompareInner = dynamic(() => import('./ThesisCompareChartInner'), {
  ssr: false,
  loading: () => <Skeleton active style={{ height: CHART_HEIGHT }} />,
});

const RUN_COLORS = ['#00e6b8', '#f5c451', '#818cf8'];

export function thesisCompareColors(): string[] {
  return RUN_COLORS;
}

function buildCompareDataNormalized(runs: CompareRun[]) {
  const bases = runs.map((run) => {
    const first = run.series[0];
    return first && first.price_usd > 0 ? first.price_usd : null;
  });
  const dates = new Set<string>();
  runs.forEach((r) => r.series.forEach((s) => dates.add(s.date)));
  const sorted = [...dates].sort();
  return sorted.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) };
    runs.forEach((run, i) => {
      const base = bases[i];
      const pt = run.series.find((s) => s.date === date);
      if (pt && base) {
        row[`p${i}`] = Math.round((pt.price_usd / base) * 1000) / 10;
      }
    });
    return row;
  });
}

function sameInputHash(runs: CompareRun[]): boolean {
  if (runs.length < 2) return false;
  const h = runs[0]!.inputHash;
  return runs.every((r) => r.inputHash === h);
}

function outputHashesDiffer(runs: CompareRun[]): boolean {
  const outs = new Set(runs.map((r) => r.outputHash));
  return outs.size > 1;
}

export function ThesisCompareChart({ runs }: { runs: CompareRun[] }) {
  const { t } = useI18n();
  const data = useMemo(() => buildCompareDataNormalized(runs), [runs]);

  if (runs.length < 2) return null;

  const duplicateInput = sameInputHash(runs);
  const drift = duplicateInput && outputHashesDiffer(runs);

  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Text strong>{t('snapshots.compareTitle')}</Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
        {t('snapshots.compareHint')}
      </Typography.Text>
      <ThesisCompareMetricsTable runs={runs} />
      {duplicateInput ? (
        <Alert
          style={{ marginTop: 10 }}
          type={drift ? 'warning' : 'info'}
          showIcon
          title={drift ? t('snapshots.compareSameInputDrift') : t('snapshots.compareSameInput')}
        />
      ) : (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 12, marginBottom: 8 }}>
            {t('snapshots.compareNormalized')}
          </Typography.Text>
          <CompareInner data={data} runs={runs} height={CHART_HEIGHT} normalized />
        </>
      )}
    </div>
  );
}
