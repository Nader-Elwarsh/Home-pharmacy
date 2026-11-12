export type TimelineKind =
  | 'visit'
  | 'document'
  | 'prescription'
  | 'treatment_start'
  | 'treatment_end'
  | 'appointment';

export const TIMELINE_LABELS: Record<TimelineKind, string> = {
  visit: 'زيارة طبيب',
  document: 'مستند طبي',
  prescription: 'روشتة',
  treatment_start: 'بداية علاج',
  treatment_end: 'نهاية علاج',
  appointment: 'موعد',
};

export interface TimelineEvent {
  id: string;
  date: string;
  kind: TimelineKind;
  title: string;
  subtitle?: string;
}

export interface Timeline {
  /** من اليوم فصاعدًا، الأقرب أولًا */
  upcoming: TimelineEvent[];
  /** قبل اليوم، الأحدث أولًا */
  past: TimelineEvent[];
}

export function buildTimeline(events: ReadonlyArray<TimelineEvent>, today: string): Timeline {
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const past = events
    .filter((e) => e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return { upcoming, past };
}
