import type { Validation } from './householdRules';

/** يحوّل الأرقام العربية الهندية (٠-٩) والفارسية (۰-۹) إلى أرقام لاتينية. */
export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** عدد صحيح غير سالب. الفارغ = 0. */
export function parseCount(raw: string, label: string, max: number): Validation<number> {
  const value = normalizeDigits(raw).trim();
  if (value === '') return { ok: true, value: 0 };
  if (!/^\d+$/.test(value)) return { ok: false, error: `${label} يجب أن يكون رقمًا صحيحًا` };
  const n = Number(value);
  if (n > max) return { ok: false, error: `${label} كبير جدًا` };
  return { ok: true, value: n };
}
