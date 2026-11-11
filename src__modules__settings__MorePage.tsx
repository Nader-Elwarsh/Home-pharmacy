import { PageHeader } from '@/components/PageHeader';
import { ROADMAP_MODULES } from '@/app/roadmap';

export function MorePage() {
  return (
    <>
      <PageHeader title="المزيد" subtitle="الإعدادات والوحدات القادمة" />
      <section className="card" aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">وحدات قادمة</h2>
        <p>هذه الوحدات غير متاحة بعد، وتُضاف مرحلة بعد مرحلة:</p>
        <ul className="plain-list">
          {ROADMAP_MODULES.map((m) => (
            <li key={m.title}>
              <span>{m.title}</span> <span className="muted">({m.phase})</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
