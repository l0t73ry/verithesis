import { AntdProvider } from '@/components/AntdProvider';
import { Dashboard } from '@/components/Dashboard';
import { I18nProvider } from '@/lib/i18n/context';

export default function Home() {
  return (
    <I18nProvider>
      <AntdProvider>
        <Dashboard />
      </AntdProvider>
    </I18nProvider>
  );
}
