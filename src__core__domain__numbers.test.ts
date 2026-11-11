import { describe, expect, it } from 'vitest';
import { normalizeDigits, parseCount } from './numbers';

describe('normalizeDigits', () => {
  it('يحوّل الأرقام العربية والفارسية', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeDigits('٦/٢٠٢٧ abc')).toBe('6/2027 abc');
  });
});

describe('parseCount', () => {
  it('الفارغ = 0', () => {
    expect(parseCount('  ', 'س', 100)).toEqual({ ok: true, value: 0 });
  });
  it('يقبل الأرقام العربية', () => {
    expect(parseCount('٣', 'س', 100)).toEqual({ ok: true, value: 3 });
  });
  it('يرفض غير الأرقام والسالب والكسور والأكبر من الحد', () => {
    expect(parseCount('ab', 'س', 100).ok).toBe(false);
    expect(parseCount('-1', 'س', 100).ok).toBe(false);
    expect(parseCount('1.5', 'س', 100).ok).toBe(false);
    expect(parseCount('101', 'س', 100).ok).toBe(false);
  });
});
