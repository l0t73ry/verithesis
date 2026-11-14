'use client';

import type { CSSProperties, ReactNode } from 'react';
import { DownOutlined, RiseOutlined, FallOutlined, MinusOutlined } from '@ant-design/icons';
import { Col, Collapse, Flex, Row, Space, Statistic, Tag, Typography } from 'antd';
import type { ThesisResult } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';
import { formatConclusionBrief } from '@/lib/conclusion-copy';
import { signalVisual } from '@/lib/signal-visual';
import { vt } from '@/lib/verithesis-visual-tokens';

const SIGNAL_ICON = {
  up: RiseOutlined,
  down: FallOutlined,
  flat: MinusOutlined,
} as const;

export function ThesisResultSummary({
  result,
  onOpenAttestation,
}: {
  result: ThesisResult;
  onOpenAttestation: () => void;
}) {
  const { t, messages } = useI18n();
  const c = result.conclusion;
  const meta = signalVisual(c.signal);
  const signalLabel = t(`signal.${c.signal}` as 'signal.bullish');
  const copy = formatConclusionBrief(messages.conclusion, c, result.input.target_token, result.strategy_mode);
  const att = result.attestation;
  const Icon = SIGNAL_ICON[meta.glyph];

  return (
    <Flex vertical gap={12}>
      <MotionHero className="vt-signal-hero" style={{ borderColor: meta.border, background: meta.bg }}>
        <Flex align="center" justify="space-between" wrap gap={12}>
          <Space align="center" size={12}>
            <Flex
              align="center"
              justify="center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${meta.border}`,
                color: meta.color,
                fontSize: 18,
              }}
            >
              <Icon />
            </Flex>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('dashboard.signal')}
              </Typography.Text>
              <Typography.Text style={{ margin: 0, color: meta.color, fontWeight: 600, fontSize: 17, lineHeight: 1.25 }}>
                {signalLabel}
              </Typography.Text>
            </div>
          </Space>
          <Row gutter={16} style={{ flex: '1 1 280px', maxWidth: 420 }}>
            <Col span={8}>
              <Statistic
                title={t('dashboard.sharpe')}
                value={c.sharpe_ratio ?? 0}
                styles={{ content: { fontFamily: 'var(--font-mono)', fontSize: 17, color: vt.colorText } }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={t('dashboard.maxDrawdown')}
                value={c.max_drawdown_pct ?? 0}
                suffix="%"
                styles={{ content: { fontFamily: 'var(--font-mono)', fontSize: 17 } }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={t('dashboard.strategyVsBh')}
                value={c.strategy_return_pct ?? 0}
                suffix="%"
                styles={{
                  content: {
                    fontFamily: 'var(--font-mono)',
                    fontSize: 17,
                    color: (c.strategy_return_pct ?? 0) >= (c.buy_hold_return_pct ?? 0) ? vt.colorPrimary : vt.colorText,
                  },
                }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                B&H {c.buy_hold_return_pct ?? 0}%
              </Typography.Text>
            </Col>
          </Row>
        </Flex>
      </MotionHero>

      <div>
        <Typography.Text style={{ fontSize: 15, display: 'block' }}>{copy.headline}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13, lineHeight: 1.5 }}>
          {copy.summary}
        </Typography.Paragraph>
        <Space size={6} wrap>
          <Tag variant="filled" color="cyan">
            GitHub {c.github_commits_7d ?? 0}/7d
          </Tag>
          <Tag variant="filled">funding ~{c.funding_rate_bps ?? 0} bps</Tag>
          <Tag variant="filled">whale ~{c.whale_net_flow_musd ?? 0}M</Tag>
          <Tag variant="filled">w_tvl {Math.round((c.tvl_weight ?? 0.5) * 100)}%</Tag>
          <Tag color="default" variant="filled" style={{ fontSize: 11 }}>
            {t('results.factorDemo')}
          </Tag>
        </Space>
      </div>

      <Typography.Link onClick={onOpenAttestation} style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        {t('results.trustLine', {
          hash: att.input_hash.slice(0, 10),
          provider: att.provider,
          quote: att.quote.status,
        })}
      </Typography.Link>

      <Collapse
        ghost
        size="small"
        className="vt-metrics-collapse"
        expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} style={{ fontSize: 11 }} />}
        items={[
          {
            key: 'metrics',
            label: (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('results.expandMetrics')}
              </Typography.Text>
            ),
            children: (
              <Row gutter={[12, 8]} className="vt-stats-row">
                <Col xs={12} sm={8}>
                  <Statistic
                    title={t('dashboard.metricsR')}
                    value={`${c.pearson_r} / ${c.r_squared}`}
                    styles={{ content: { fontFamily: 'var(--font-mono)', fontSize: 16 } }}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic
                    title={t('dashboard.hitRate')}
                    value={c.backtest_hit_rate}
                    suffix="%"
                    styles={{ content: { fontSize: 18 } }}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic
                    title={t('dashboard.buyHoldReturn')}
                    value={c.buy_hold_return_pct ?? 0}
                    suffix="%"
                    styles={{ content: { fontSize: 18, color: '#94a3b8' } }}
                  />
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </Flex>
  );
}

/** Avoid motion lib — simple div wrapper for styling hook */
function MotionHero({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={className} style={{ borderRadius: vt.borderRadius, border: '1px solid', padding: '12px 14px', ...style }}>
      {children}
    </div>
  );
}
