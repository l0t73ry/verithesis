import { AntdProvider } from '@/components/AntdProvider';
import { Dashboard } from '@/components/Dashboard';
import { GhostoreAuthProvider } from '@/lib/ghostore-auth-context';
import { I18nProvider } from '@/lib/i18n/context';

export default function Home() {
  return (
    <I18nProvider>
      <GhostoreAuthProvider>
        <AntdProvider>
          <Dashboard />
        </AntdProvider>
      </GhostoreAuthProvider>
    </I18nProvider>
  );
}
