import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';

export function HealthPage() {
  return (
    <>
      <PageHeader title="الصحة" subtitle="الملفات الصحية والتحاليل والروشتات" />
      <ComingSoon phase="P5" what="حفظ التحاليل والأشعة والروشتات والسجل الزمني" />
    </>
  );
}
