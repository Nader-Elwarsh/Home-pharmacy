import { describe, expect, it } from 'vitest';
import {
  balanceByBatch,
  EXPIRING_SOON_DAYS,
  expiryStatus,
  fefoNextBatchId,
  formatQuantity,
  summarizeItem,
} from './stock';

const TODAY = '2026-11-11';

describe('expiryStatus', () => {
  it('منتهي قبل اليوم، وصالح في يوم الانتهاء نفسه', () => {
    expect(expiryStatus('2026-11-10', TODAY)).toBe('expired');
    expect(expiryStatus('2026-11-11', TODAY)).toBe('expiring_soon');
  });
  it('قريب الانتهاء حتى الحد ثم صالح', () => {
    expect(EXPIRING_SOON_DAYS).toBe(60);
    expect(expiryStatus('2027-01-10', TODAY)).toBe('expiring_soon'); // 60 يومًا
    expect(expiryStatus('2027-01-11', TODAY)).toBe('ok'); // 61 يومًا
  });
});

describe('balanceByBatch', () => {
  it('الرصيد = مجموع الحركات لكل تشغيلة', () => {
    const m = balanceByBatch([
      { batchId: 'a', qtyBaseUnits: 10 },
      { batchId: 'a', qtyBaseUnits: -3 },
      { batchId: 'b', qtyBaseUnits: 5 },
    ]);
    expect(m.get('a')).toBe(7);
    expect(m.get('b')).toBe(5);
    expect(m.get('c')).toBeUndefined();
  });
});

describe('formatQuantity', () => {
  it('وحدة العبوة 1', () => {
    expect(formatQuantity(3, 1, 'علبة')).toBe('3 علبة');
  });
  it('عبوات ووحدات', () => {
    expect(formatQuantity(25, 10, 'قرص')).toBe('2 عبوة و5 قرص (25 قرص)');
    expect(formatQuantity(20, 10, 'قرص')).toBe('2 عبوة (20 قرص)');
    expect(formatQuantity(7, 10, 'قرص')).toBe('7 قرص');
    expect(formatQuantity(0, 10, 'قرص')).toBe('0 قرص');
  });
});

describe('FEFO', () => {
  const batches = [
    { id: 'late', expiryDate: '2027-12-31', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'soon', expiryDate: '2027-01-31', createdAt: '2026-02-01T00:00:00Z' },
    { id: 'expired', expiryDate: '2026-01-31', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'empty', expiryDate: '2026-12-31', createdAt: '2025-06-01T00:00:00Z' },
  ];
  const balances = new Map([
    ['late', 5],
    ['soon', 5],
    ['expired', 5],
    ['empty', 0],
  ]);

  it('يقترح الأقرب انتهاءً بين غير المنتهي وذي الكمية', () => {
    expect(fefoNextBatchId(batches, balances, TODAY)).toBe('soon');
  });
  it('لا اقتراح إن لم توجد تشغيلة صالحة', () => {
    expect(fefoNextBatchId(batches, new Map([['expired', 5]]), TODAY)).toBeUndefined();
  });
  it('عند تساوي الصلاحية يقدّم الأقدم إضافة', () => {
    const tie = [
      { id: 'n', expiryDate: '2027-05-31', createdAt: '2026-03-01T00:00:00Z' },
      { id: 'o', expiryDate: '2027-05-31', createdAt: '2026-02-01T00:00:00Z' },
    ];
    expect(fefoNextBatchId(tie, new Map([['n', 1], ['o', 1]]), TODAY)).toBe('o');
  });
});

describe('summarizeItem', () => {
  const b = (id: string, expiryDate: string) => ({ id, expiryDate, createdAt: '2026-01-01T00:00:00Z' });

  it('نفد: لا كمية', () => {
    expect(summarizeItem([b('a', '2027-12-31')], new Map([['a', 0]]), TODAY).status).toBe('empty');
    expect(summarizeItem([], new Map(), TODAY).status).toBe('empty');
  });
  it('المنتهي له الأولوية على قريب الانتهاء', () => {
    const s = summarizeItem(
      [b('a', '2026-01-31'), b('c', '2026-12-01'), b('d', '2028-01-01')],
      new Map([['a', 2], ['c', 3], ['d', 4]]),
      TODAY,
    );
    expect(s).toMatchObject({ totalQty: 9, expiredQty: 2, expiringQty: 3, status: 'expired' });
    expect(s.nearestExpiry).toBe('2026-01-31');
  });
  it('قريب الانتهاء ثم سليم', () => {
    expect(summarizeItem([b('c', '2026-12-01')], new Map([['c', 1]]), TODAY).status).toBe('expiring_soon');
    expect(summarizeItem([b('d', '2028-01-01')], new Map([['d', 1]]), TODAY).status).toBe('ok');
  });
  it('التشغيلة الفارغة لا تؤثر في الحالة', () => {
    const s = summarizeItem(
      [b('a', '2026-01-31'), b('d', '2028-01-01')],
      new Map([['a', 0], ['d', 4]]),
      TODAY,
    );
    expect(s.status).toBe('ok');
    expect(s.nearestExpiry).toBe('2028-01-01');
  });
});
