import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';

export function CabinetPage() {
  return (
    <>
      <PageHeader title="الخزانة" subtitle="الأدوية والمستلزمات الطبية" />
      <ComingSoon phase="P3" what="تسجيل الأصناف والتشغيلات والكميات وتواريخ الصلاحية" />
    </>
  );
}

export function HealthPage() {
  return (
    <>
      <PageHeader title="الصحة" subtitle="الملفات الصحية والتحاليل والروشتات" />
      <ComingSoon phase="P5" what="حفظ التحاليل والأشعة والروشتات والسجل الزمني" />
    </>
  );
}
