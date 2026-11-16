'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GithubOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Form,
  InputNumber,
  Layout,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import type { SnapshotRecord, StrategyMode, TargetToken, ThesisInput, ThesisResult, Timeframe } from '@verithesis/enclave-worker';
import { AiAssistant } from './AiAssistant';
import { AttestationModal } from './AttestationModal';
import { DashboardHeader } from './DashboardHeader';
import { PaywallBanner } from './PaywallBanner';
import { ResultActionBar } from './ResultActionBar';
import { RunConfigChips } from './RunConfigChips';
import { ThesisResultSummary } from './ThesisResultSummary';
import { SnapshotTimeline } from './SnapshotTimeline';
import { ThesisChart } from './ThesisChart';
import { ThesisCompareChart, thesisCompareColors, type CompareRun } from './ThesisCompareChart';
import { VerifyHashBanner } from './VerifyHashBanner';
import { useI18n } from '@/lib/i18n/context';
import { mergeSnapshotLists, listLocalSnapshots, putLocalRun } from '@/lib/run-indexeddb';
import { loadGhostoreSession } from '@/lib/ghostore-auth';
import { useGhostoreAuth } from '@/lib/ghostore-auth-context';
import { fetchArchivedRun } from '@/lib/resolve-run';

const { Content, Footer } = Layout;
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/l0t73ry/verithesis';

const cardStyles = {
  header: { minHeight: 44, alignItems: 'center' as const },
  body: { padding: '14px 16px' },
};

export function Dashboard() {
  const { t, messages } = useI18n();
  const { message } = App.useApp();
  const { refreshQuota } = useGhostoreAuth();
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [targetToken, setTargetToken] = useState<TargetToken>('NEAR');
  const [smoothing, setSmoothing] = useState(1);
  const [tvlWeightPct, setTvlWeightPct] = useState(50);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>('public');
  const [realtimeUnlocked, setRealtimeUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThesisResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [selectedSnap, setSelectedSnap] = useState<string | undefined>();
  const [snapLoading, setSnapLoading] = useState(false);
  const [runInTee, setRunInTee] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareRuns, setCompareRuns] = useState<CompareRun[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [teeAvailable, setTeeAvailable] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const loadVerifiedResult = useCallback((r: ThesisResult) => {
    setResult(r);
    setModalOpen(true);
  }, []);

  const loadSnapshots = useCallback(async () => {
    const [serverRes, local] = await Promise.all([
      fetch('/api/thesis/snapshots').then((r) => r.json()),
      listLocalSnapshots(),
    ]);
    setSnapshots(mergeSnapshotLists(serverRes.snapshots ?? [], local));
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/thesis/capabilities')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTeeAvailable(Boolean(data?.tee?.available));
      })
      .catch(() => {
        if (!cancelled) setTeeAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCompare = useCallback(
    (id: string) => {
      setCompareIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 3) {
          message.warning(t('snapshots.compareMax'));
          return prev;
        }
        const nextSnap = snapshots.find((s) => s.id === id);
        if (nextSnap && prev.some((pid) => snapshots.find((s) => s.id === pid)?.input_hash === nextSnap.input_hash)) {
          message.info(t('snapshots.compareSameInputHint'));
        }
        return [...prev, id];
      });
    },
    [message, snapshots, t],
  );

  useEffect(() => {
    if (compareIds.length === 0) {
      setCompareRuns([]);
      return;
    }
    let cancelled = false;
    setCompareLoading(true);
    void (async () => {
      try {
        const colors = thesisCompareColors();
        const runs: CompareRun[] = [];
        for (let i = 0; i < compareIds.length; i++) {
          const id = compareIds[i];
          const snap = snapshots.find((s) => s.id === id);
          if (!snap) continue;
          const archived = await fetchArchivedRun(snap.output_hash, 'run');
          if (!archived) continue;
          runs.push({
            id: snap.id,
            label: `${snap.saved_at.slice(0, 10)} · ${snap.target_token} · ${t(`signal.${snap.signal}` as 'signal.bullish')}`,
            color: colors[i % colors.length]!,
            series: archived.series,
            inputHash: snap.input_hash,
            outputHash: snap.output_hash,
            savedAt: snap.saved_at,
            timeframe: snap.timeframe,
            targetToken: snap.target_token,
            smoothing: archived.input.smoothing_window ?? 1,
            conclusion: archived.conclusion,
          });
        }
        if (!cancelled) setCompareRuns(runs);
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compareIds, snapshots, t]);

  const rerun = useCallback(async (overrides?: Partial<ThesisInput>) => {
    setLoading(true);
    setError(null);
    try {
      const body = {
        timeframe: overrides?.timeframe ?? timeframe,
        target_token: overrides?.target_token ?? targetToken,
        smoothing_window: overrides?.smoothing_window ?? smoothing,
        tvl_weight: overrides?.tvl_weight ?? tvlWeightPct / 100,
        strategy_mode: overrides?.strategy_mode ?? strategyMode,
        // The server decides realtime access from the receipt (demo stub); no client-side flag.
        payment_receipt: overrides?.realtime_unlocked || realtimeUnlocked ? 'demo-near-0.1' : null,
        tee: runInTee,
      };
      const authHeaders: Record<string, string> = { 'content-type': 'application/json' };
      const gs = loadGhostoreSession();
      if (gs?.accessToken) authHeaders.Authorization = `Bearer ${gs.accessToken}`;
      const res = await fetch('/api/thesis/rerun', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        if (data.code === 'AUTH_REQUIRED') throw new Error(t('dashboard.loginRequired'));
        if (data.code === 'SNAPSHOT_MISSING') throw new Error(t('dashboard.snapshotMissing'));
        throw new Error(data.error ?? res.statusText);
      }
      const next = data as ThesisResult;
      setResult(next);
      await putLocalRun(next);
      await loadSnapshots();
      await refreshQuota();
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.requestFailed'));
    } finally {
      setLoading(false);
    }
  }, [timeframe, targetToken, smoothing, tvlWeightPct, strategyMode, realtimeUnlocked, runInTee, loadSnapshots, refreshQuota, t]);

  const applyAi = (partial: Partial<ThesisInput>) => {
    if (partial.timeframe) setTimeframe(partial.timeframe);
    if (partial.target_token) setTargetToken(partial.target_token);
    if (partial.smoothing_window != null) setSmoothing(partial.smoothing_window);
    if (partial.tvl_weight != null) setTvlWeightPct(Math.round(partial.tvl_weight * 100));
    if (partial.strategy_mode) setStrategyMode(partial.strategy_mode);
  };


  const selectSnapshot = useCallback(
    async (id: string) => {
      setSelectedSnap(id);
      const snap = snapshots.find((s) => s.id === id);
      if (!snap) return;
      setSnapLoading(true);
      try {
        const archived = await fetchArchivedRun(snap.output_hash, 'run');
        if (!archived) return;
        setResult(archived);
        if (archived.input.timeframe) setTimeframe(archived.input.timeframe);
        if (archived.input.target_token) setTargetToken(archived.input.target_token);
        if (archived.input.smoothing_window != null) setSmoothing(archived.input.smoothing_window);
        if (archived.input.tvl_weight != null) setTvlWeightPct(Math.round(archived.input.tvl_weight * 100));
        if (archived.strategy_mode) setStrategyMode(archived.strategy_mode);
        setRealtimeUnlocked(Boolean(archived.input.realtime_unlocked));
      } catch {
        /* ignore */
      } finally {
        setSnapLoading(false);
      }
    },
    [snapshots],
  );

  const unlockRealtime = () => {
    setRealtimeUnlocked(true);
    rerun({ realtime_unlocked: true });
  };

  const activeSnap = snapshots.find((s) => s.id === selectedSnap);

  return (
    <Layout className="vt-shell" style={{ background: 'transparent', minHeight: '100vh' }}>
      <Content style={{ paddingTop: 0 }}>
        <DashboardHeader hasResult={Boolean(result)} onOpenAttestation={() => setModalOpen(true)} />
        <VerifyHashBanner onOpenAttestation={() => setModalOpen(true)} onLoadResult={loadVerifiedResult} />
        <Row gutter={[12, 12]} align="stretch">
          <Col xs={24} lg={15} className="vt-stretch-col">
            <Card
              styles={cardStyles}
              title={t('dashboard.paramsTitle')}
              extra={
                <Segmented<StrategyMode>
                  size="middle"
                  value={strategyMode}
                  onChange={setStrategyMode}
                  options={[
                    { label: t('dashboard.modePublic'), value: 'public' },
                    { label: t('dashboard.modeSealed'), value: 'sealed' },
                  ]}
                />
              }
            >
              <Form layout="vertical" requiredMark={false}>
                <div className="vt-params-grid">
                  <Form.Item label={t('dashboard.timeframe')}>
                    <Select<Timeframe>
                      size="middle"
                      value={timeframe}
                      onChange={setTimeframe}
                      options={[
                        { value: '7d', label: '7d' },
                        { value: '30d', label: '30d' },
                        { value: '90d', label: '90d' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('dashboard.token')}>
                    <Select<TargetToken>
                      size="middle"
                      value={targetToken}
                      onChange={setTargetToken}
                      options={[
                        { value: 'NEAR', label: 'NEAR' },
                        { value: 'REF', label: 'REF' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('dashboard.smoothWindow')}>
                    <InputNumber
                      size="middle"
                      min={1}
                      max={14}
                      value={smoothing}
                      onChange={(v) => setSmoothing(v ?? 1)}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label={t('dashboard.tvlWeight')} className="vt-params-span">
                    <Slider
                      min={20}
                      max={80}
                      value={tvlWeightPct}
                      onChange={setTvlWeightPct}
                      marks={{ 20: '20%', 50: '50%', 80: '80%' }}
                      tooltip={{ formatter: (v) => `${v}%` }}
                    />
                  </Form.Item>
                </div>
              </Form>
              <div className="vt-params-actions">
                <Flex className="vt-params-actions__row" justify="space-between" align="center" wrap="wrap" gap={10}>
                  <div className="vt-params-tee">
                    <Space align="center" size={8} wrap>
                      <Switch
                        size="small"
                        checked={runInTee}
                        disabled={!teeAvailable}
                        onChange={(on) => {
                          setRunInTee(on);
                          if (on) message.info(t('dashboard.teeOn'));
                        }}
                      />
                      <Typography.Text style={{ fontSize: 13 }}>{t('dashboard.tee')}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary" className="vt-params-tee-hint">
                      {teeAvailable ? t('dashboard.teeHint') : t('dashboard.teeUnavailable')}
                    </Typography.Text>
                  </div>
                  <Button type="primary" size="middle" loading={loading} onClick={() => rerun()}>
                    {t('dashboard.rerun')}
                  </Button>
                </Flex>
              </div>
            {error ? <Alert style={{ marginTop: 12 }} type="error" showIcon title={error} /> : null}
          </Card>
          </Col>
          <Col xs={24} lg={9} className="vt-stretch-col">
            <AiAssistant onApply={applyAi} />
          </Col>
        </Row>

        <div ref={resultsRef}>
        <Card
          title={t('dashboard.resultsTitle')}
          extra={result ? <RunConfigChips input={result.input} mode={result.strategy_mode} /> : null}
          style={{ marginTop: 12 }}
          styles={cardStyles}
        >
          {!result && !loading ? (
            <div className="vt-results-placeholder">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                styles={{ image: { height: 40, marginBottom: 8 } }}
                description={
                  <Flex vertical gap={4} align="center">
                    <Typography.Text strong>{t('empty.title')}</Typography.Text>
                    <Typography.Text type="secondary" style={{ maxWidth: 400, textAlign: 'center', fontSize: 13 }}>
                      {t('empty.hintScroll')}
                    </Typography.Text>
                  </Flex>
                }
              />
            </div>
          ) : null}

          {loading && !result ? (
            <Flex vertical align="center" gap={8} className="vt-results-placeholder vt-results-loading">
              <Spin size="small" />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {t('dashboard.rerunLoading')}
              </Typography.Text>
            </Flex>
          ) : null}

          {result ? (
            <div className={loading ? 'vt-results-busy' : undefined} aria-busy={loading}>
              <Flex vertical gap={12}>
                <PaywallBanner lagged={Boolean(result.series_lagged)} onUnlock={unlockRealtime} unlocking={loading} />
                <ThesisResultSummary result={result} onOpenAttestation={() => setModalOpen(true)} />
                <ThesisChart series={result.series} />
                <ResultActionBar result={result} onOpenAttestation={() => setModalOpen(true)} />
              </Flex>
              {loading ? (
                <Flex align="center" justify="center" className="vt-results-busy-spin">
                  <Spin size="small" />
                </Flex>
              ) : null}
            </div>
          ) : null}
        </Card>
        </div>

        <Card title={t('dashboard.snapshotsTitle')} style={{ marginTop: 12 }} styles={cardStyles}>
          <SnapshotTimeline
            snapshots={snapshots}
            selectedId={selectedSnap}
            compareIds={compareIds}
            loading={snapLoading}
            onSelect={selectSnapshot}
            onToggleCompare={toggleCompare}
          />
          {compareLoading ? (
            <Flex justify="center" style={{ marginTop: 12, padding: '8px 0' }}>
              <Spin size="small" />
            </Flex>
          ) : (
            <ThesisCompareChart runs={compareRuns} />
          )}
          {activeSnap ? (
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon={false}
              title={
                <Typography.Text code style={{ fontSize: 11, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                  {activeSnap.headline}{' '}
                  · {t('dashboard.snapshotOut')} {activeSnap.output_hash.slice(0, 20)}…
                </Typography.Text>
              }
              description={t('snapshots.restoreHint')}
            />
          ) : null}
        </Card>
      </Content>

      <Footer style={{ background: 'transparent', padding: '16px 0 0', marginTop: 4 }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            © {new Date().getFullYear()} VeriThesis
          </Typography.Text>
          <Typography.Link href={GITHUB_URL} target="_blank">
            <Space size={6}>
              <GithubOutlined />
              {t('dashboard.github')}
            </Space>
          </Typography.Link>
        </Flex>
      </Footer>

      <AttestationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        attestation={result?.attestation ?? null}
        nearOnchain={result?.near_onchain}
      />
    </Layout>
  );
}
