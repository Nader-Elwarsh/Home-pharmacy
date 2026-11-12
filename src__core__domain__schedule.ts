import { normalizeDigits } from './numbers';
import type { Validation } from './householdRules';

export const MAX_TIMES_PER_DAY = 8;

/** يقبل "8:00، 20:00" أو "08:00 20:00" بأرقام عربية أو لاتينية. يعيد أوقاتًا مرتبة بلا تكرار. */
export function parseTimes(raw: string): Validation<string[]> {
  const text = normalizeDigits(raw).replace(/[،,;]/g, ' ').trim();
  if (text === '') return { ok: true, value: [] };
  const set = new Set<string>();
  for (const part of text.split(/\s+/)) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(part);
    if (!m) return { ok: false, error: `الوقت "${part}" غير صحيح. اكتب مثلًا 08:00` };
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return { ok: false, error: `الوقت "${part}" غير صحيح` };
    set.add(`${String(h).padStart(2, '0')}:${m[2]}`);
  }
  if (set.size > MAX_TIMES_PER_DAY) {
    return { ok: false, error: `الحد الأقصى ${MAX_TIMES_PER_DAY} مواعيد في اليوم` };
  }
  return { ok: true, value: [...set].sort() };
}

export type DoseStatus = 'taken' | 'missed' | 'skipped' | 'postponed';
export type DoseState = DoseStatus | 'overdue' | 'pending';

export const DOSE_STATUS_LABELS: Record<DoseState, string> = {
  taken: 'تم أخذها',
  missed: 'لم تؤخذ',
  skipped: 'تم تخطيها',
  postponed: 'مؤجلة',
  overdue: 'فائتة وتحتاج تسجيلًا',
  pending: 'قادمة',
};

export interface DoseItem {
  id: string;
  treatmentId: string;
  profileId: string;
  name: string;
  times: string[];
  startDate: string;
  endDate?: string;
}

export interface DoseLogLite {
  slotKey: string;
  status: DoseStatus;
}

export interface DoseSlot {
  slotKey: string;
  treatmentItemId: string;
  treatmentId: string;
  profileId: string;
  name: string;
  date: string;
  time: string;
  state: DoseState;
}

export function slotKey(treatmentItemId: string, date: string, time: string): string {
  return `${treatmentItemId}|${date}|${time}`;
}

/**
 * مواعيد الجرعات ليوم معيّن من الجدول الذي أدخله المستخدم فقط (لا يُنشأ جدول تلقائيًا).
 * الجرعة الفائتة تبقى "فائتة" ولا تُضاعف ولا تُعوَّض.
 */
export function buildDoseSlots(
  items: ReadonlyArray<DoseItem>,
  logs: ReadonlyArray<DoseLogLite>,
  date: string,
  today: string,
  nowHm: string,
): DoseSlot[] {
  const logByKey = new Map(logs.map((l) => [l.slotKey, l.status]));
  const slots: DoseSlot[] = [];

  for (const item of items) {
    if (date < item.startDate) continue;
    if (item.endDate && date > item.endDate) continue;
    for (const time of item.times) {
      const key = slotKey(item.id, date, time);
      const logged = logByKey.get(key);
      let state: DoseState;
      if (logged) state = logged;
      else if (date < today || (date === today && time < nowHm)) state = 'overdue';
      else state = 'pending';
      slots.push({
        slotKey: key,
        treatmentItemId: item.id,
        treatmentId: item.treatmentId,
        profileId: item.profileId,
        name: item.name,
        date,
        time,
        state,
      });
    }
  }
  return slots.sort((a, b) => (a.time === b.time ? a.name.localeCompare(b.name, 'ar') : a.time.localeCompare(b.time)));
}
