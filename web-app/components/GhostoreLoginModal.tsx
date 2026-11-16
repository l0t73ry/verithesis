'use client';

import { Form, Input, Modal, Typography } from 'antd';
import { useGhostoreAuth } from '@/lib/ghostore-auth-context';
import { useI18n } from '@/lib/i18n/context';

export function GhostoreLoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { login, loggingIn } = useGhostoreAuth();
  const { t } = useI18n();
  const [form] = Form.useForm<{ username: string; password: string }>();

  return (
    <Modal
      title={t('auth.loginTitle')}
      open={open}
      onCancel={onClose}
      okText={t('auth.loginSubmit')}
      confirmLoading={loggingIn}
      destroyOnClose
      onOk={() =>
        form.validateFields().then(async (values) => {
          await login(values.username, values.password);
          onClose();
        })
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('auth.loginHint')}
      </Typography.Paragraph>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="username" label={t('auth.username')} rules={[{ required: true, message: t('auth.usernameRequired') }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, message: t('auth.passwordRequired') }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}