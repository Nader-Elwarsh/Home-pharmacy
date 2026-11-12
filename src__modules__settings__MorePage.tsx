import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

const LINKS = [
  { to: '/treatments', label: 'العلاجات وجرعات اليوم' },
  { to: '/appointments', label: 'المواعيد والمهام' },
  { to: '/shopping', label: 'قائمة المشتريات' },
  { to: '/contacts', label: 'دليلي (أطباء وصيدليات)' },
  { to: '/report', label: 'تقرير الأدوية الموجودة لدي' },
  { to: '/backup', label: 'النسخ الاحتياطي والاستعادة' },
];

export function MorePage() {
  return (
    <>
      <PageHeader title="المزيد" />
      <section className="card link-list">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>{l.label}</Link>
        ))}
      </section>
      <section className="card">
        <h2>قريبًا</h2>
        <p className="muted">الحسابات والمزامنة بين الأجهزة، مشاركة الأسرة، الدليل العام، المجتمع. تحتاج خادمًا وتُضاف بعد اكتمال الأساس.</p>
      </section>
    </>
  );
}
