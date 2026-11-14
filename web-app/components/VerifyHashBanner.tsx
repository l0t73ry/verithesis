'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Space, Typography } from 'antd';
import type { ThesisResult } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';
import { fetchArchivedRun } from '@/lib/resolve-run';

export function VerifyHashBanner({
  onOpenAttestation,
  onLoadResult,
}: {
  onOpenAttestation: () => void;
  onLoadResult: (result: ThesisResult) => void;
}) {
  const { t } = useI18n();
  const [hash, setHash] = useState<string | null>(null);
  const [lookupMode, setLookupMode] = useState<'run' | 'hash'>('run');
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'missing' | 'checking'>('idle');
  const [recheck, setRecheck] = useState<{ input_match: boolean; output_match: boolean } | null>(null);
  const onLoadRef = useRef(onLoadResult);
  onLoadRef.current = onLoadResult;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const run = params.get('run')?.trim();
    const inputHash = params.get('hash')?.trim();
    const ref = run ?? inputHash;
    if (!ref) return;

    let cancelled = false;
    setHash(ref);
    setLookupMode(run ? 'run' : 'hash');
    setStatus('loading');

    void fetchArchivedRun(ref, run ? 'run' : 'hash').then((result) => {
      if (cancelled) return;
      if (result) {
        onLoadRef.current(result);
        setStatus('found');
      } else {
        setStatus('missing');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function reverify() {
    if (!hash) return;
    setStatus('checking');
    setRecheck(null);
    try {
      const res = await fetch('/api/thesis/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lookupMode === 'run' ? { run: hash } : { hash }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('missing');
        return;
      }
      setRecheck({ input_match: data.input_match, output_match: data.output_match });
      setStatus('found');
    } catch {
      setStatus('found');
    }
  }

  if (!hash || status === 'idle' || status === 'loading') return null;

  if (status === 'missing') {
    return (
      <Alert
        style={{ marginBottom: 12 }}
        type="warning"
        showIcon
        title={t('verify.notFound')}
        description={
          <Typography.Text type="secondary">{t('verify.notFoundHint', { hash: hash.slice(0, 16) })}</Typography.Text>
        }
      />
    );
  }

  return (
    <Alert
      style={{ marginBottom: 12 }}
      type={recheck?.output_match === false ? 'warning' : 'success'}
      showIcon
      title={t('verify.loaded')}
      description={
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
            {hash}
          </Typography.Text>
          {recheck ? (
            <Typography.Text type="secondary">
              {recheck.output_match ? t('verify.outputMatch') : t('verify.outputMismatch')}
            </Typography.Text>
          ) : null}
          <Space wrap>
            <Button size="small" onClick={onOpenAttestation}>
              {t('dashboard.verifiedBadge')}
            </Button>
            <Button size="small" type="primary" ghost onClick={reverify} loading={status === 'checking'}>
              {t('verify.recheck')}
            </Button>
          </Space>
        </Space>
      }
    />
  );
}
