import { describe, expect, it } from 'vitest';
import { NAME_MAX, validateBirthDate, validateName } from './householdRules';

const TODAY = new Date(2026, 10, 11); // 11 نوفمبر 2026

describe('validateName', () => {
  it('يقص المسافات ويقبل اسمًا صحيحًا', () => {
    expect(validateName('  أحمد  ')).toEqual({ ok: true, value: 'أحمد' });
  });
  it('يرفض الفارغ والمسافات فقط', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
  });
  it('يرفض الاسم الأطول من الحد', () => {
    expect(validateName('ا'.repeat(NAME_MAX + 1)).ok).toBe(false);
    expect(validateName('ا'.repeat(NAME_MAX)).ok).toBe(true);
  });
});

describe('validateBirthDate', () => {
  it('الفارغ مقبول (اختياري)', () => {
    expect(validateBirthDate('', TODAY)).toEqual({ ok: true, value: undefined });
  });
  it('يقبل تاريخًا صحيحًا', () => {
    expect(validateBirthDate('1990-05-20', TODAY)).toEqual({ ok: true, value: '1990-05-20' });
  });
  it('يرفض الصيغة الخاطئة', () => {
    expect(validateBirthDate('20/05/1990', TODAY).ok).toBe(false);
  });
  it('يرفض تاريخًا غير موجود', () => {
    expect(validateBirthDate('2023-02-30', TODAY).ok).toBe(false);
  });
  it('يرفض تاريخ المستقبل ويقبل اليوم نفسه', () => {
    expect(validateBirthDate('2026-11-12', TODAY).ok).toBe(false);
    expect(validateBirthDate('2026-11-11', TODAY).ok).toBe(true);
  });
});
