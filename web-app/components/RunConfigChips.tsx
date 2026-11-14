'use client';

import { Space, Tag } from 'antd';
import type { StrategyMode, ThesisInput } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';

export function RunConfigChips({ input, mode }: { input: ThesisInput; mode: StrategyMode }) {
  const { t } = useI18n();
  const w = Math.round((input.tvl_weight ?? 0.5) * 100);
  return (
    <Space size={4} wrap>
      <Tag variant="filled">{input.timeframe}</Tag>
      <Tag variant="filled">{input.target_token}</Tag>
      <Tag variant="filled">
        {t('dashboard.smoothWindow')} {input.smoothing_window ?? 1}
      </Tag>
      <Tag variant="filled">w_tvl {w}%</Tag>
      <Tag color={mode === 'sealed' ? 'purple' : 'default'} variant="filled">
        {mode === 'sealed' ? t('dashboard.modeSealed') : t('dashboard.modePublic')}
      </Tag>
    </Space>
  );
}
