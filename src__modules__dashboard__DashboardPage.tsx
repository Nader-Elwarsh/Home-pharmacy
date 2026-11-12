import { Link } from 'react-router-dom';
import { ErrorLine, Loading } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { DOSE_STATUS_LABELS } from '@/core/domain/schedule';
import { loadDashboard, type AlertItem } from '@/core/services/dashboardService';
import { useLoader } from '@/hooks/useLoader';
import { useLocalDbStatus } from './useLocalDbStatus';

function AlertList({ title, kind, items }: { title: string; kind: 'danger' | 'warning' | 'info'; items: AlertItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card">
      <h2>
        <StatusBadge kind={kind} label={`${title} (${items.length})`} />
      </h2>
      <ul className="plain-list">
        {items.map((i) => (
          <li key={i.id}>
            <Link to={`/cabinet/${i.id}`}>{i.name}</Link> {i.detail && <span className="muted">— {i.detail}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardPage() {
  const db = useLocalDbStatus();
  const { state } = useLoader(async () => loadDashboard(), []);

  return (
    <>
      <PageHeader title="الرئيسية" subtitle="صيدلية البيت" />

      {!db.loading && !db.ready && <StatusBadge kind="danger" label="تعذر فتح قاعدة البيانات المحلية" />}
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorLine message={state.message} />}
      {state.status === 'ready' && !state.data.hasHousehold && (
        <section className="card">
          <h2>ابدأ من هنا</h2>
          <p>أنشئ منزلك وأضف أفراد الأسرة، ثم سجّل أدويتك.</p>
          <Link to="/family">إنشاء المنزل</Link>
        </section>
      )}

      {state.status === 'ready' && state.data.hasHousehold && (
        <>
          {state.data.backupReminder && (
            <section className="card">
              <StatusBadge kind="warning" label={state.data.backupReminder} /> <Link to="/backup">النسخ الاحتياطي</Link>
            </section>
          )}

          <section className="card">
            <h2>{state.data.householdName}</h2>
            <p>
              {state.data.itemCount} صنف في الخزانة — <Link to="/cabinet">فتح الخزانة</Link>
            </p>
            {state.data.shoppingPending > 0 && (
              <p>
                {state.data.shoppingPending} في قائمة المشتريات — <Link to="/shopping">عرض</Link>
              </p>
            )}
          </section>

          <AlertList title="منتهية الصلاحية" kind="danger" items={state.data.expired} />
          <AlertList title="قريبة الانتهاء" kind="warning" items={state.data.expiringSoon} />
          <AlertList title="كمية قليلة" kind="warning" items={state.data.lowStock} />
          <AlertList title="نفدت" kind="info" items={state.data.empty} />

          {state.data.doses.length > 0 && (
            <section className="card">
              <h2>جرعات اليوم</h2>
              <ul className="plain-list">
                {state.data.doses.map((d) => (
                  <li key={d.slotKey}>
                    {d.time} — {d.name} <span className="muted">({d.profileName})</span> — {DOSE_STATUS_LABELS[d.state]}
                  </li>
                ))}
              </ul>
              <Link to="/treatments">تسجيل الجرعات</Link>
            </section>
          )}

          {state.data.appointments.length > 0 && (
            <section className="card">
              <h2>مواعيد الأسبوع</h2>
              <ul className="plain-list">
                {state.data.appointments.map((a) => (
                  <li key={a.id}>{a.date}{a.time && ` ${a.time}`} — {a.title} <span className="muted">({a.profileName})</span></li>
                ))}
              </ul>
            </section>
          )}

          {state.data.tasks.length > 0 && (
            <section className="card">
              <h2>مهام قريبة</h2>
              <ul className="plain-list">
                {state.data.tasks.map((t) => (
                  <li key={t.id}>{t.title}{t.dueDate && <span className="muted"> — حتى {t.dueDate}</span>}</li>
                ))}
              </ul>
              <Link to="/appointments">المواعيد والمهام</Link>
            </section>
          )}
        </>
      )}

      <section className="card" aria-labelledby="safety-title">
        <h2 id="safety-title">تنبيه مهم</h2>
        <p>
          هذا التطبيق لتنظيم ما لديك من أدوية ومستندات فقط. لا يقدم تشخيصًا ولا يصف علاجًا ولا يحدد جرعات. أي قرار علاجي يعود للطبيب أو الصيدلي.
        </p>
      </section>
    </>
  );
}
