import { Route, Routes } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { FamilyPage } from '@/modules/family/FamilyPage';
import { CabinetPage } from '@/modules/cabinet/CabinetPage';
import { ItemDetailPage } from '@/modules/cabinet/ItemDetailPage';
import { NewItemPage } from '@/modules/cabinet/NewItemPage';
import { HealthPage } from '@/modules/placeholders/placeholderPages';
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
        <Route path="cabinet/new" element={<NewItemPage />} />
        <Route path="cabinet/:id" element={<ItemDetailPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
