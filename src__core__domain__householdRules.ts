export const NAME_MAX = 80;

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateName(raw: string): Validation<string> {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: 'الاسم مطلوب' };
  if (value.length > NAME_MAX) {
    return { ok: false, error: `الاسم طويل جدًا (الحد ${NAME_MAX} حرفًا)` };
  }
  return { ok: true, value };
}

/** تاريخ الميلاد اختياري. الصيغة YYYY-MM-DD، ولا يكون في المستقبل. فارغ = غير مُدخل. */
export function validateBirthDate(
  raw: string,
  today: Date = new Date(),
): Validation<string | undefined> {
  const value = raw.trim();
  if (value === '') return { ok: true, value: undefined };

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { ok: false, error: 'صيغة التاريخ غير صحيحة' };

  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  const real =
    parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
  if (!real) return { ok: false, error: 'التاريخ غير موجود' };

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (parsed.getTime() > todayUtc) return { ok: false, error: 'تاريخ الميلاد في المستقبل' };

  return { ok: true, value };
}
