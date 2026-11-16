'use client';

import { useEffect, useState } from 'react';
import { SafetyCertificateOutlined, LinkOutlined, DownloadOutlined, BankOutlined } from '@ant-design/icons';
import { App, Button, Space, Spin } from 'antd';
import { buildRunReceipt } from '@verithesis/enclave-worker/receipt';
import type { ThesisResult, VaultExecutionPlan } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';
import { formatConclusionBrief } from '@/lib/conclusion-copy';
import { renderShareCardPng } from '@/lib/share-card-canvas';
import { VaultPlanDrawer } from './VaultPlanDrawer';
import { loadGhostoreSession } from '@/lib/ghostore-auth';

type QrState = { status: 'loading' } | { status: 'ready'; src: string } | { status: 'failed' };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ResultActionBar({
  result,
  onOpenAttestation,
}: {
  result: ThesisResult;
  onOpenAttestation: () => void;
}) {
  const { t, messages } = useI18n();
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qr, setQr] = useState<QrState>({ status: 'loading' });
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultPlan, setVaultPlan] = useState<VaultExecutionPlan | null>(null);

  const verifyUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/?run=${result.attestation.output_hash}` : '';

  useEffect(() => {
    if (!verifyUrl) return;
    let cancelled = false;
    setQr({ status: 'loading' });
    const api = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(verifyUrl)}`;
    fetch(api)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(blobToDataUrl)
      .then((src) => {
        if (!cancelled) setQr({ status: 'ready', src });
      })
      .catch(() => {
        if (!cancelled) setQr({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  async function download() {
    setDownloading(true);
    try {
      const localized = formatConclusionBrief(
        messages.conclusion,
        result.conclusion,
        result.input.target_token,
        result.strategy_mode,
      );
      const c = result.conclusion;
      const dataUrl = await renderShareCardPng(
        result,
        {
          resultsTitle: t('dashboard.resultsTitle'),
          signal: t('dashboard.signal'),
          signalValue: t(`signal.${result.conclusion.signal}` as 'signal.bullish'),
          sharpe: t('dashboard.sharpe'),
          maxDrawdown: t('dashboard.maxDrawdown'),
          strategyVsBh: t('dashboard.strategyVsBh'),
          buyHoldLine: `B&H ${c.buy_hold_return_pct ?? 0}%`,
          factorDemo: t('results.factorDemo'),
          cardTag: t('share.cardTag'),
          chartTitle: t('chart.title'),
          chartDays: t('chart.days', { n: String(result.series.length) }),
          chartPrice: t('chart.price'),
          chartTvl: t('chart.tvl'),
          verifyHint: t('share.cardVerify'),
        },
        qr.status === 'ready' ? qr.src : null,
        localized,
      );
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `verithesis-${result.attestation.input_hash.slice(0, 8)}.png`;
      a.click();
      message.success(t('share.downloaded'));
    } catch {
      message.error(t('share.failed'));
    } finally {
      setDownloading(false);
    }
  }

  function downloadReceipt() {
    const receipt = buildRunReceipt(result);
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verithesis-receipt-${result.attestation.output_hash.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('share.receiptSaved'));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      message.success(t('share.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error(t('dashboard.requestFailed'));
    }
  }

  async function openVault() {
    try {
      const authHeaders: Record<string, string> = { 'content-type': 'application/json' };
      const gs = loadGhostoreSession();
      if (gs?.accessToken) authHeaders.Authorization = `Bearer ${gs.accessToken}`;
      const res = await fetch('/api/thesis/vault', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ output_hash: result.attestation.output_hash }),
      });
      if (!res.ok) throw new Error('vault');
      const data = await res.json();
      const plan = data.plan ?? null;
      if (!plan) {
        message.error(t('dashboard.requestFailed'));
        return;
      }
      setVaultPlan(plan);
      setVaultOpen(true);
    } catch {
      message.error(t('dashboard.requestFailed'));
    }
  }

  return (
    <>
      <div className="vt-result-actions">
        <Space wrap size={8}>
          <Button
            type="primary"
            size="middle"
            icon={<DownloadOutlined />}
            loading={downloading}
            disabled={qr.status === 'loading'}
            onClick={download}
          >
            {t('share.button')}
          </Button>
          <Button size="middle" icon={<LinkOutlined />} onClick={copyLink}>
            {copied ? t('share.copied') : t('share.copyLink')}
          </Button>
          <Button size="middle" onClick={downloadReceipt}>
            {t('share.receipt')}
          </Button>
          <Button size="middle" icon={<SafetyCertificateOutlined />} onClick={onOpenAttestation}>
            {t('dashboard.verifiedBadge')}
          </Button>
          {result.vault_eligible ? (
            <Button size="middle" icon={<BankOutlined />} onClick={openVault}>
              {t('dashboard.vaultPreview')}
            </Button>
          ) : null}
          {qr.status === 'loading' ? <Spin size="small" /> : null}
        </Space>
      </div>
      <VaultPlanDrawer open={vaultOpen} onClose={() => setVaultOpen(false)} plan={vaultPlan} />
    </>
  );
}
