'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellOutlined, DeleteOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, List, Space, Typography } from 'antd';
import { loadGhostoreSession } from '@/lib/ghostore-auth';
import { useGhostoreAuth } from '@/lib/ghostore-auth-context';
import { useI18n } from '@/lib/i18n/context';

type SubRow = { id: number; webhook_url: string; enabled: number; created_at: string };

export function SignalSubscribePanel() {
  const { t } = useI18n();
  const { session } = useGhostoreAuth();
  const [items, setItems] = useState<SubRow[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const gs = loadGhostoreSession();
    return gs?.accessToken ? { Authorization: `Bearer ${gs.accessToken}` } : {};
  }, []);

  const reload = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const res = await fetch('/api/ghostore/signals/subscriptions', { headers: authHeaders(), cache: 'no-store' });
      const body = (await res.json()) as { data?: { items?: SubRow[] }; error?: string };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setItems(body.data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.requestFailed'));
    }
  }, [authHeaders, session, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!session) return null;

  async function onFinish(values: { webhook_url: string }) {
    setLoading(true);
    setSecret(null);
    setError(null);
    try {
      const res = await fetch('/api/ghostore/signals/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ webhook_url: values.webhook_url.trim() }),
      });
      const body = (await res.json()) as { data?: { webhook_secret?: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setSecret(body.data?.webhook_secret ?? null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.requestFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/ghostore/signals/subscriptions?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('delete failed');
      await reload();
    } catch {
      setError(t('dashboard.requestFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Alert
      type="info"
      showIcon
      icon={<BellOutlined />}
      title={t('signalSub.title')}
      style={{ marginBottom: 12 }}
      description={
        <div style={{ marginTop: 8 }}>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
            {t('signalSub.intro')}
          </Typography.Paragraph>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="webhook_url"
              label={t('signalSub.webhook')}
              rules={[{ required: true, type: 'url' }]}
            >
              <Input placeholder="https://example.com/hooks/verithesis" />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} size="small">
                {t('signalSub.add')}
              </Button>
            </Space>
          </Form>
          {secret ? (
            <Typography.Paragraph style={{ marginTop: 8, fontSize: 12 }}>
              {t('signalSub.secretOnce')} <Typography.Text code>{secret}</Typography.Text>
            </Typography.Paragraph>
          ) : null}
          {error ? (
            <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
              {error}
            </Typography.Text>
          ) : null}
          {items.length > 0 ? (
            <List
              size="small"
              style={{ marginTop: 12 }}
              dataSource={items}
              renderItem={(row) => (
                <List.Item
                  actions={[
                    <Button
                      key="del"
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(row.id)}
                    />,
                  ]}
                >
                  <Typography.Text ellipsis style={{ maxWidth: '100%' }}>
                    {row.webhook_url}
                  </Typography.Text>
                </List.Item>
              )}
            />
          ) : null}
        </div>
      }
    />
  );
}