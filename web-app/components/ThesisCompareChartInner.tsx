'use client';

import { Typography } from 'antd';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CompareRun } from './ThesisCompareChart';
import { useI18n } from '@/lib/i18n/context';

export default function ThesisCompareChartInner({
  data,
  runs,
  height,
  normalized,
}: {
  data: Record<string, string | number>[];
  runs: CompareRun[];
  height: number;
  normalized?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={11} width={48} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: '#0f1419',
              border: '1px solid #334155',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {runs.map((run, i) => (
            <Line
              key={run.id}
              type="monotone"
              dataKey={`p${i}`}
              name={run.label}
              stroke={run.color}
              dot={false}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
        {normalized ? t('snapshots.compareNormalizedCaption') : t('snapshots.comparePriceOnly')}
      </Typography.Text>
    </div>
  );
}
