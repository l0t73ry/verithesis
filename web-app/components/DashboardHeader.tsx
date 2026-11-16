'use client';

import { useState } from 'react';
import { LoginOutlined, LogoutOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Tag, Typography } from 'antd';
import { GhostoreLoginModal } from './GhostoreLoginModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useGhostoreAuth } from '@/lib/ghostore-auth-context';
import { useI18n } from '@/lib/i18n/context';
import { vt } from '@/lib/verithesis-visual-tokens';

export function DashboardHeader({ hasResult, onOpenAttestation }: { hasResult: boolean; onOpenAttestation: () => void }) {
  const { t } = useI18n();
  const { session, quota, logout } = useGhostoreAuth();
  const [loginOpen, setLoginOpen] = useState(false);

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
        {session ? (
          <>
            <Tag color="blue">{session.username}</Tag>
            {quota ? (
              <Tag>
                {t('auth.quota', { remaining: String(quota.remaining), limit: String(quota.runs_limit) })}
              </Tag>
            ) : null}
            <Button size="middle" icon={<LogoutOutlined />} onClick={logout}>
              {t('auth.logout')}
            </Button>
          </>
        ) : (
          <Button size="middle" icon={<LoginOutlined />} onClick={() => setLoginOpen(true)}>
            {t('auth.login')}
          </Button>
        )}
        {hasResult ? (
          <Button type="primary" size="middle" ghost icon={<SafetyCertificateOutlined />} onClick={onOpenAttestation}>
            {t('dashboard.verifiedBadge')}
          </Button>
        ) : null}
      </Space>
      <GhostoreLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}
