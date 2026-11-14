'use client';

import { useState } from 'react';
import { RobotOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Typography } from 'antd';
import type { ThesisInput } from '@verithesis/enclave-worker';
import { useI18n } from '@/lib/i18n/context';

const cardStyles = {
  header: { minHeight: 44, alignItems: 'center' as const },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: 10 },
};

export function AiAssistant({ onApply }: { onApply: (partial: Partial<ThesisInput>) => void }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [reply, setReply] = useState('');
  const [pending, setPending] = useState<Partial<ThesisInput> | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!query.trim()) return;
    setLoading(true);
    setPending(null);
    try {
      const res = await fetch('/api/thesis/parse-query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, locale }),
      });
      const data = await res.json();
      setReply(data.reply ?? '');
      if (data.params && Object.keys(data.params).length > 0) {
        setPending(data.params as Partial<ThesisInput>);
      } else {
        setPending(null);
      }
    } catch {
      setReply(t('ai.parseFailed'));
      setPending(null);
    } finally {
      setLoading(false);
    }
  }

  function applyToForm() {
    if (!pending) return;
    onApply(pending);
    setReply((r) => (r ? `${r}\n${t('ai.appliedHint')}` : t('ai.appliedHint')));
    setPending(null);
  }

  return (
    <Card
      styles={cardStyles}
      title={
        <SpaceTitle>
          <RobotOutlined style={{ color: '#a5b4fc' }} />
          {t('ai.title')}
        </SpaceTitle>
      }
    >
      <Input.TextArea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={5}
        style={{ resize: 'none' }}
        placeholder={t('ai.placeholder')}
      />
      <Button type="default" size="middle" block disabled={loading || !query.trim()} loading={loading} onClick={send}>
        {loading ? t('ai.parsing') : t('ai.parse')}
      </Button>
      {pending ? (
        <Button type="primary" size="middle" block onClick={applyToForm}>
          {t('ai.apply')}
        </Button>
      ) : null}
      {reply ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {reply}
        </Typography.Paragraph>
      ) : null}
    </Card>
  );
}

function SpaceTitle({ children }: { children: React.ReactNode }) {
  return (
    <Flex align="center" gap={8}>
      {children}
    </Flex>
  );
}
