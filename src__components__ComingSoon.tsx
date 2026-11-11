import { StatusBadge } from './StatusBadge';

interface Props {
  phase: string;
  what: string;
}

/** تُستخدم بدل أي زر أو واجهة وهمية: تقول صراحةً أن الوظيفة لم تُنفَّذ بعد. */
export function ComingSoon({ phase, what }: Props) {
  return (
    <section className="card" aria-label="هذه الوحدة قادمة">
      <StatusBadge kind="info" label="قريبًا" />
      <p>{what}</p>
      <p className="muted">تُنفَّذ هذه الوحدة في المرحلة {phase}، وهي غير متاحة حاليًا.</p>
    </section>
  );
}
