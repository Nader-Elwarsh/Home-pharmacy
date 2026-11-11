import { describe, expect, it } from 'vitest';
import { daysBetween, formatExpiry, parseExpiry, parsePastOrTodayDate, todayString } from './dates';

describe('todayString', () => {
  it('يعيد تاريخ اليوم المحلي بصيغة YYYY-MM-DD', () => {
    expect(todayString(new Date(2026, 10, 5))).toBe('2026-11-05');
  });
});

describe('parseExpiry', () => {
  it('الشهر والسنة يعنيان آخر يوم في الشهر', () => {
    expect(parseExpiry('06/2027')).toEqual({
      ok: true,
      value: { date: '2027-06-30', precision: 'month' },
    });
    expect(parseExpiry('2/2028')).toEqual({
      ok: true,
      value: { date: '2028-02-29', precision: 'month' },
    });
    expect(parseExpiry('2027-02')).toEqual({
      ok: true,
      value: { date: '2027-02-28', precision: 'month' },
    });
  });

  it('يقبل اليوم الكامل بصيغتين', () => {
    expect(parseExpiry('2027-06-15')).toEqual({
      ok: true,
      value: { date: '2027-06-15', precision: 'day' },
    });
    expect(parseExpiry('15/6/2027')).toEqual({
      ok: true,
      value: { date: '2027-06-15', precision: 'day' },
    });
  });

  it('يقبل الأرقام العربية', () => {
    expect(parseExpiry('٠٦/٢٠٢٧')).toEqual({
      ok: true,
      value: { date: '2027-06-30', precision: 'month' },
    });
  });

  it('يرفض الفارغ والصيغ الغريبة والتواريخ غير الموجودة', () => {
    expect(parseExpiry('').ok).toBe(false);
    expect(parseExpiry('قريبا').ok).toBe(false);
    expect(parseExpiry('13/2027').ok).toBe(false);
    expect(parseExpiry('00/2027').ok).toBe(false);
    expect(parseExpiry('2027-02-30').ok).toBe(false);
    expect(parseExpiry('06/1990').ok).toBe(false);
  });
});

describe('daysBetween', () => {
  it('يحسب الفرق بالأيام عبر الشهور والسنوات الكبيسة', () => {
    expect(daysBetween('2026-11-11', '2026-11-11')).toBe(0);
    expect(daysBetween('2026-11-11', '2026-11-12')).toBe(1);
    expect(daysBetween('2026-11-11', '2026-11-10')).toBe(-1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
});

describe('parsePastOrTodayDate', () => {
  const today = '2026-11-11';
  it('الفارغ مقبول', () => {
    expect(parsePastOrTodayDate('', today)).toEqual({ ok: true, value: undefined });
  });
  it('يقبل اليوم والماضي ويرفض المستقبل', () => {
    expect(parsePastOrTodayDate('2026-11-11', today).ok).toBe(true);
    expect(parsePastOrTodayDate('2025-01-01', today).ok).toBe(true);
    expect(parsePastOrTodayDate('2026-11-12', today).ok).toBe(false);
  });
  it('يرفض صيغة خاطئة وتاريخًا غير موجود', () => {
    expect(parsePastOrTodayDate('11/11/2026', today).ok).toBe(false);
    expect(parsePastOrTodayDate('2026-02-30', today).ok).toBe(false);
  });
});

describe('formatExpiry', () => {
  it('يعرض الشهر فقط أو اليوم الكامل بحسب الدقة', () => {
    expect(formatExpiry('2027-06-30', 'month')).toBe('06/2027');
    expect(formatExpiry('2027-06-15', 'day')).toBe('2027-06-15');
  });
});
