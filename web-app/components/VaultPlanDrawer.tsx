'use client';

import { Descriptions, Drawer, Typography } from 'antd';
import type { VaultExecutionPlan } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';

export function VaultPlanDrawer({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  plan: VaultExecutionPlan | null;
}) {
  const { t } = useI18n();
  if (!plan) return null;

  return (
    <Drawer title={t('vault.drawerTitle')} open={open} onClose={onClose} width={400}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        {t('vault.drawerIntro')}
      </Typography.Paragraph>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('vault.status')}>{plan.status}</Descriptions.Item>
        {plan.reason ? <Descriptions.Item label={t('vault.reason')}>{plan.reason}</Descriptions.Item> : null}
        <Descriptions.Item label={t('vault.network')}>{plan.network}</Descriptions.Item>
        <Descriptions.Item label={t('vault.dex')}>{plan.dex}</Descriptions.Item>
        <Descriptions.Item label={t('vault.swap')}>
          {plan.amount_near} {plan.from_token} → {plan.to_token}
        </Descriptions.Item>
        <Descriptions.Item label={t('vault.policy')}>
          max {plan.policy.max_per_trade_near} NEAR · {plan.policy.max_trades_per_day}/day
        </Descriptions.Item>
        {plan.dao_risk ? (
          <Descriptions.Item label={t('vault.daoTitle')}>
            <Typography.Text type={plan.dao_risk.approved ? 'success' : 'danger'}>
              {plan.dao_risk.approved ? t('vault.daoApproved') : t('vault.daoRejected')}
            </Typography.Text>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12 }}>
              {plan.dao_risk.gates.map((g) => (
                <li key={g.id} style={{ color: g.pass ? undefined : '#cf1322' }}>
                  {g.id}: {g.detail}
                </li>
              ))}
            </ul>
          </Descriptions.Item>
        ) : null}
        <Descriptions.Item label={t('attestation.inputHash')}>
          <Typography.Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
            {plan.attestation_input_hash}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
}
