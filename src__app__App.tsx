import { Route, Routes } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { CabinetPage, FamilyPage, HealthPage } from '@/modules/placeholders/placeholderPages';
import { MorePage } from '@/modules/settings/MorePage';
import { AppShell } from './AppShell';

function NotFoundPage() {
  return <PageHeader title="الصفحة غير موجودة" subtitle="تأكد من الرابط أو عد إلى الرئيسية" />;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="cabinet" element={<CabinetPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
