import type { Validation } from './householdRules';
import { parseCount } from './numbers';
import { MAX_QTY } from './inventoryRules';
import type { TransactionType } from './inventoryTypes';

export interface TxLite {
  id: string;
  batchId: string;
  type: TransactionType;
  qtyBaseUnits: number;
  reversesId?: string;
}

export const TX_LABELS: Record<TransactionType, string> = {
  purchase: 'إضافة كمية',
  dispense: 'صرف',
  consume: 'استهلاك',
  adjust: 'تسوية جرد',
  reversal: 'تصحيح (عكس حركة)',
};

/** كمية بالعبوات + وحدات سائبة إلى وحدة أساسية. */
export function parseQuantity(
  packsRaw: string,
  unitsRaw: string,
  unitsPerPack: number,
): Validation<number> {
  const packs = parseCount(packsRaw, unitsPerPack === 1 ? 'العدد' : 'عدد العبوات', MAX_QTY);
  if (!packs.ok) return packs;
  const units =
    unitsPerPack === 1 ? { ok: true as const, value: 0 } : parseCount(unitsRaw, 'عدد الوحدات', MAX_QTY);
  if (!units.ok) return units;
  const total = packs.value * unitsPerPack + units.value;
  if (total > MAX_QTY) return { ok: false, error: 'الكمية كبيرة جدًا' };
  return { ok: true, value: total };
}

/** لا يُسمح بسحب أكبر من الرصيد: لا مخزون سالب. */
export function checkWithdrawal(balance: number, qty: number): Validation<number> {
  if (qty <= 0) return { ok: false, error: 'أدخل كمية أكبر من صفر' };
  if (qty > balance) return { ok: false, error: 'الكمية المطلوبة أكبر من المتاح في هذه العبوات' };
  return { ok: true, value: qty };
}

/** التسوية: الفرق بين الكمية المعدودة فعليًا والرصيد الدفتري. */
export function adjustmentDelta(balance: number, counted: number): number {
  return counted - balance;
}

export function canReverse(tx: TxLite, all: ReadonlyArray<TxLite>): Validation<TxLite> {
  if (tx.type === 'reversal') return { ok: false, error: 'لا يمكن عكس حركة تصحيح' };
  if (all.some((t) => t.reversesId === tx.id)) return { ok: false, error: 'هذه الحركة صُححت من قبل' };
  return { ok: true, value: tx };
}

/** عكس الحركة قد يجعل الرصيد سالبًا (مثل عكس شراء بعد استهلاكه)، فيُمنع. */
export function checkReversal(
  tx: TxLite,
  all: ReadonlyArray<TxLite>,
  batchBalance: number,
): Validation<number> {
  const can = canReverse(tx, all);
  if (!can.ok) return can;
  const delta = -tx.qtyBaseUnits;
  if (batchBalance + delta < 0) {
    return { ok: false, error: 'لا يمكن عكس هذه الحركة لأن الرصيد سيصبح سالبًا' };
  }
  return { ok: true, value: delta };
}
