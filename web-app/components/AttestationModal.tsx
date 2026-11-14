'use client';

import { List, Modal, Tag, Typography } from 'antd';
import type { AttestationBundle, NearOnchainTelemetry } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';

export function AttestationModal({
  open,
  onClose,
  attestation,
  nearOnchain,
}: {
  open: boolean;
  onClose: () => void;
  attestation: AttestationBundle | null;
  nearOnchain?: NearOnchainTelemetry;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={open && Boolean(attestation)}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <div>
          <Tag color="cyan" style={{ marginBottom: 8 }}>
            {t('attestation.badge')}
          </Tag>
          <div>{t('attestation.title')}</div>
        </div>
      }
    >
      {attestation ? (
        <>
          <Typography.Paragraph type="secondary">{t('attestation.intro')}</Typography.Paragraph>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            {t('attestation.provider')}: <Typography.Text code>{attestation.provider}</Typography.Text> ·{' '}
            <Typography.Text code>{attestation.quote.status}</Typography.Text>
          </Typography.Text>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <HashRow label={t('attestation.codeMeasurement')} value={attestation.code_measurement} />
            <HashRow label={t('attestation.executionTimestamp')} value={attestation.execution_timestamp} />
            <HashRow label={t('attestation.inputHash')} value={attestation.input_hash} accent />
            <HashRow label={t('attestation.outputHash')} value={attestation.output_hash} warn />
            {nearOnchain ? (
              <HashRow
                label={t('attestation.nearAnchor')}
                value={`#${nearOnchain.block_height} · ${nearOnchain.block_hash} (${nearOnchain.active_validators} validators, ${nearOnchain.staking_ratio_pct}% staked)`}
              />
            ) : null}
            {attestation.quote.tdx_quote_b64 ? (
              <HashRow
                label={t('attestation.tdxQuote')}
                value={`${attestation.quote.tdx_quote_b64.slice(0, 48)}… (${attestation.quote.tdx_quote_b64.length} chars)`}
              />
            ) : null}
          </dl>
          <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('attestation.signatureChain')}
          </Typography.Text>
          <List
            style={{ marginTop: 12 }}
            dataSource={attestation.signature_chain}
            renderItem={(step) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{step.role}</span>
                      <StatusTag status={step.status} />
                    </span>
                  }
                  description={
                    <Typography.Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                      {step.detail}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
            {attestation.quote.verifier_hint}
          </Typography.Paragraph>
        </>
      ) : null}
    </Modal>
  );
}

function HashRow({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const color = accent ? '#00e6b8' : warn ? '#f5c451' : undefined;
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography.Text>
      <Typography.Paragraph
        style={{ marginBottom: 0, marginTop: 4, fontSize: 12, fontFamily: 'var(--font-mono)', color, wordBreak: 'break-all' }}
      >
        {value}
      </Typography.Paragraph>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === 'pass') return <Tag color="success">{t('attestation.statusPass')}</Tag>;
  if (status === 'mock') return <Tag color="default">{t('attestation.statusSimulated')}</Tag>;
  if (status === 'pending') return <Tag color="warning">{t('attestation.statusPending')}</Tag>;
  return <Tag>{status}</Tag>;
}
