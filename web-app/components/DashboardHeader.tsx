'use client';

import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Tag, Typography } from 'antd';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/lib/i18n/context';
import { vt } from '@/lib/verithesis-visual-tokens';

export function DashboardHeader({ hasResult, onOpenAttestation }: { hasResult: boolean; onOpenAttestation: () => void }) {
  const { t } = useI18n();

  return (
    <header className="vt-page-header">
      <Flex align="center" gap={12} className="vt-page-header__brand" style={{ minWidth: 0 }}>
        <Flex
          align="center"
          justify="center"
          aria-hidden
          style={{
            width: vt.logoSize,
            height: vt.logoSize,
            borderRadius: vt.logoRadius,
            border: `1px solid ${vt.logoBorder}`,
            background: vt.logoBg,
            fontWeight: 700,
            color: vt.colorPrimary,
            flexShrink: 0,
          }}
        >
          V
        </Flex>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Flex align="center" gap={8} wrap="wrap">
            <Typography.Title level={4} style={{ margin: 0, color: vt.colorText, fontWeight: 600, lineHeight: 1.2 }}>
              VeriThesis
            </Typography.Title>
            <Tag color="cyan" variant="filled" style={{ margin: 0, fontSize: 11 }}>
              {t('dashboard.tagline')}
            </Tag>
          </Flex>
          <Typography.Paragraph
            type="secondary"
            ellipsis={{ rows: 2 }}
            style={{ marginBottom: 0, marginTop: 4, fontSize: 13, lineHeight: 1.45, maxWidth: '100%' }}
          >
            {t('dashboard.subtitle')}
          </Typography.Paragraph>
        </div>
      </Flex>
      <Space className="vt-page-header__actions" wrap size={8} align="center">
        <LanguageSwitcher />
        {hasResult ? (
          <Button type="primary" size="middle" ghost icon={<SafetyCertificateOutlined />} onClick={onOpenAttestation}>
            {t('dashboard.verifiedBadge')}
          </Button>
        ) : null}
      </Space>
    </header>
  );
}
