import { normalizeDigits } from './numbers';
import type { Validation } from './householdRules';

// كل التواريخ التقويمية نصوص YYYY-MM-DD (بلا مناطق زمنية) لتجنب أخطاء الإزاحة.

export type ExpiryPrecision = 'month' | 'day';

export function todayString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function endOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * يقبل: MM/YYYY أو M-YYYY أو YYYY-MM (الشهر فقط => آخر يوم في الشهر)،
 * وYYYY-MM-DD أو D/M/YYYY (يوم كامل). يقبل الأرقام العربية.
 */
export function parseExpiry(
  raw: string,
): Validation<{ date: string; precision: ExpiryPrecision }> {
  const text = normalizeDigits(raw).trim();
  if (text === '') return { ok: false, error: 'تاريخ الصلاحية مطلوب' };

  let m: RegExpExecArray | null;
  let y: number;
  let mo: number;
  let d: number | null = null;

  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{1,2})\s*[/-]\s*(\d{4})$/.exec(text))) {
    [mo, y] = [Number(m[1]), Number(m[2])];
  } else if ((m = /^(\d{4})-(\d{1,2})$/.exec(text))) {
    [y, mo] = [Number(m[1]), Number(m[2])];
  } else {
    return { ok: false, error: 'صيغة الصلاحية غير مفهومة. اكتب مثلًا 06/2027' };
  }

  if (y < MIN_YEAR || y > MAX_YEAR) return { ok: false, error: 'السنة غير معقولة' };
  if (mo < 1 || mo > 12) return { ok: false, error: 'الشهر غير صحيح' };

  if (d === null) {
    return { ok: true, value: { date: ymd(y, mo, endOfMonth(y, mo)), precision: 'month' } };
  }
  if (!isRealDate(y, mo, d)) return { ok: false, error: 'التاريخ غير موجود' };
  return { ok: true, value: { date: ymd(y, mo, d), precision: 'day' } };
}

/** تاريخ تقويمي اختياري بصيغة YYYY-MM-DD، لا يكون بعد اليوم. الفارغ = غير مُدخل. */
export function parsePastOrTodayDate(raw: string, today: string): Validation<string | undefined> {
  const text = normalizeDigits(raw).trim();
  if (text === '') return { ok: true, value: undefined };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return { ok: false, error: 'صيغة التاريخ غير صحيحة' };
  if (!isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))) {
    return { ok: false, error: 'التاريخ غير موجود' };
  }
  if (text > today) return { ok: false, error: 'التاريخ في المستقبل' };
  return { ok: true, value: text };
}

/** تاريخ تقويمي اختياري YYYY-MM-DD دون قيد على الماضي أو المستقبل. الفارغ = غير مُدخل. */
export function parseCalendarDate(raw: string): Validation<string | undefined> {
  const text = normalizeDigits(raw).trim();
  if (text === '') return { ok: true, value: undefined };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return { ok: false, error: 'صيغة التاريخ غير صحيحة' };
  if (!isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))) {
    return { ok: false, error: 'التاريخ غير موجود' };
  }
  return { ok: true, value: text };
}

/** يضيف أيامًا (قد تكون سالبة) إلى تاريخ YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** HH:MM المحلي. */
export function timeString(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** عدد الأيام من from إلى to (موجب إن كان to بعد from). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / 86_400_000);
}

export function formatExpiry(date: string, precision: ExpiryPrecision): string {
  const [y, m] = date.split('-');
  return precision === 'month' ? `${m}/${y}` : date;
}
