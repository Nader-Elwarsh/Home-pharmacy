import { parseCalendarDate } from './dates';
import type { Validation } from './householdRules';

export function reqText(raw: string, label: string, max: number): Validation<string> {
  const value = raw.trim();
  if (value === '') return { ok: false, error: `${label} مطلوب` };
  if (value.length > max) return { ok: false, error: `${label} طويل جدًا (الحد ${max} حرفًا)` };
  return { ok: true, value };
}

export function optText(raw: string, label: string, max: number): Validation<string | undefined> {
  const value = raw.trim();
  if (value === '') return { ok: true, value: undefined };
  if (value.length > max) return { ok: false, error: `${label} طويل جدًا (الحد ${max} حرفًا)` };
  return { ok: true, value };
}

export function reqDate(raw: string, label: string): Validation<string> {
  const r = parseCalendarDate(raw);
  if (!r.ok) return { ok: false, error: `${label}: ${r.error}` };
  if (r.value === undefined) return { ok: false, error: `${label} مطلوب` };
  return { ok: true, value: r.value };
}

export function optDate(raw: string, label: string): Validation<string | undefined> {
  const r = parseCalendarDate(raw);
  return r.ok ? r : { ok: false, error: `${label}: ${r.error}` };
}

export function pickEnum<T extends string>(
  raw: string,
  allowed: readonly T[],
  label: string,
): Validation<T> {
  const found = allowed.find((a) => a === raw);
  return found ? { ok: true, value: found } : { ok: false, error: `${label} غير صحيح` };
}

/** معرّف مرجعي مطلوب (مثل الفرد). */
export function reqId(raw: string, label: string): Validation<string> {
  const value = raw.trim();
  return value === '' ? { ok: false, error: `${label} مطلوب` } : { ok: true, value };
}

export function optId(raw: string): Validation<string | undefined> {
  const value = raw.trim();
  return { ok: true, value: value === '' ? undefined : value };
}

export type Checked<T extends Record<string, Validation<unknown>>> = {
  [K in keyof T]: T[K] extends Validation<infer V> ? V : never;
};

/** يتحقق من مجموعة حقول: يعيد أول خطأ، أو كل القيم مع حذف غير المُدخل. */
export function collect<T extends Record<string, Validation<unknown>>>(
  fields: T,
): Validation<Checked<T>> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    const r = fields[key];
    if (!r.ok) return { ok: false, error: r.error };
    if (r.value !== undefined) out[key] = r.value;
  }
  return { ok: true, value: out as Checked<T> };
}
