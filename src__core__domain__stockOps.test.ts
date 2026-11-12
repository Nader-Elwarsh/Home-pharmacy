import { describe, expect, it } from 'vitest';
import { adjustmentDelta, canReverse, checkReversal, checkWithdrawal, parseQuantity, type TxLite } from './stockOps';

describe('parseQuantity', () => {
  it('عبوات ووحدات', () => {
    expect(parseQuantity('2', '5', 10)).toEqual({ ok: true, value: 25 });
    expect(parseQuantity('3', '', 1)).toEqual({ ok: true, value: 3 });
    expect(parseQuantity('', '', 10)).toEqual({ ok: true, value: 0 });
  });
  it('يرفض غير الأرقام', () => {
    expect(parseQuantity('x', '', 10).ok).toBe(false);
  });
});

describe('checkWithdrawal (لا مخزون سالب)', () => {
  it('يسمح بحد الرصيد ويرفض ما فوقه والصفر', () => {
    expect(checkWithdrawal(10, 10).ok).toBe(true);
    expect(checkWithdrawal(10, 11).ok).toBe(false);
    expect(checkWithdrawal(10, 0).ok).toBe(false);
    expect(checkWithdrawal(0, 1).ok).toBe(false);
  });
});

describe('adjustmentDelta', () => {
  it('الفرق بين المعدود والدفتري', () => {
    expect(adjustmentDelta(10, 7)).toBe(-3);
    expect(adjustmentDelta(10, 12)).toBe(2);
    expect(adjustmentDelta(5, 5)).toBe(0);
  });
});

describe('عكس الحركات', () => {
  const buy: TxLite = { id: 'buy', batchId: 'b', type: 'purchase', qtyBaseUnits: 10 };
  const use: TxLite = { id: 'use', batchId: 'b', type: 'consume', qtyBaseUnits: -4 };
  const rev: TxLite = { id: 'rev', batchId: 'b', type: 'reversal', qtyBaseUnits: 4, reversesId: 'use' };

  it('عكس الاستهلاك يعيد الكمية', () => {
    expect(checkReversal(use, [buy, use], 6)).toEqual({ ok: true, value: 4 });
  });
  it('لا يُعكس تصحيح ولا حركة صُححت من قبل', () => {
    expect(canReverse(rev, [buy, use, rev]).ok).toBe(false);
    expect(canReverse(use, [buy, use, rev]).ok).toBe(false);
    expect(canReverse(buy, [buy, use, rev]).ok).toBe(true);
  });
  it('عكس شراء بعد استهلاك جزء منه يجعل الرصيد سالبًا فيُمنع', () => {
    expect(checkReversal(buy, [buy, use], 6).ok).toBe(false);
    expect(checkReversal(buy, [buy], 10)).toEqual({ ok: true, value: -10 });
  });
});
