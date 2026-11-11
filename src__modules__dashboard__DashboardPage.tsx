import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useLocalDbStatus } from './useLocalDbStatus';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-EG', { dateStyle: 'long' });
}

export function DashboardPage() {
  const status = useLocalDbStatus();

  return (
    <>
      <PageHeader title="الرئيسية" subtitle="مرحبًا بك في صيدلية البيت" />

      <section className="card" aria-labelledby="db-status-title">
        <h2 id="db-status-title">التخزين على هذا الجهاز</h2>
        {status.loading ? (
          <StatusBadge kind="info" label="جارٍ الفحص" />
        ) : status.ready ? (
          <>
            <StatusBadge kind="ok" label="قاعدة البيانات المحلية تعمل" />
            {status.firstOpenAt && (
              <p>أول فتح للتطبيق على هذا الجهاز: {formatDate(status.firstOpenAt)}</p>
            )}
          </>
        ) : (
          <StatusBadge kind="danger" label="تعذر فتح قاعدة البيانات المحلية" />
        )}
      </section>

      <section className="card" aria-labelledby="safety-title">
        <h2 id="safety-title">تنبيه مهم</h2>
        <p>
          هذا التطبيق لتنظيم ما لديك من أدوية ومستندات فقط. لا يقدم تشخيصًا ولا يصف علاجًا ولا
          يحدد جرعات. أي قرار علاجي يعود للطبيب أو الصيدلي.
        </p>
      </section>
    </>
  );
}
