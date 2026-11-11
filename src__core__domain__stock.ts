import { daysBetween } from './dates';

/** الأيام التي تُعتبر فيها الصلاحية "قريبة". */
export const EXPIRING_SOON_DAYS = 60;

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'ok';
export type ItemStatus = 'empty' | 'expired' | 'expiring_soon' | 'ok';

export function expiryStatus(expiryDate: string, today: string): ExpiryStatus {
  const days = daysBetween(today, expiryDate);
  // تاريخ الصلاحية نفسه يُعتبر صالحًا حتى نهاية يومه
  if (days < 0) return 'expired';
  if (days <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'ok';
}

export function daysUntilExpiry(expiryDate: string, today: string): number {
  return daysBetween(today, expiryDate);
}

/** الكمية ليست حقلًا يُعدَّل؛ هي مجموع حركات الدفتر لكل تشغيلة. */
export function balanceByBatch(
  txs: ReadonlyArray<{ batchId: string; qtyBaseUnits: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) map.set(t.batchId, (map.get(t.batchId) ?? 0) + t.qtyBaseUnits);
  return map;
}

export function formatQuantity(total: number, unitsPerPack: number, baseUnit: string): string {
  if (unitsPerPack <= 1) return `${total} ${baseUnit}`;
  const packs = Math.floor(total / unitsPerPack);
  const units = total % unitsPerPack;
  const parts: string[] = [];
  if (packs > 0) parts.push(`${packs} عبوة`);
  if (units > 0) parts.push(`${units} ${baseUnit}`);
  if (parts.length === 0) return `0 ${baseUnit}`;
  const text = parts.join(' و');
  return packs > 0 ? `${text} (${total} ${baseUnit})` : text;
}

export interface BatchLike {
  id: string;
  expiryDate: string;
  createdAt: string;
}

/**
 * اقتراح FEFO: التشغيلة غير المنتهية ذات الكمية المتبقية والأقرب انتهاءً.
 * اقتراح عرض فقط، ولا يُنفَّذ أي صرف تلقائيًا.
 */
export function fefoNextBatchId(
  batches: ReadonlyArray<BatchLike>,
  balances: ReadonlyMap<string, number>,
  today: string,
): string | undefined {
  const candidates = batches
    .filter((b) => (balances.get(b.id) ?? 0) > 0 && expiryStatus(b.expiryDate, today) !== 'expired')
    .sort((a, b) =>
      a.expiryDate === b.expiryDate
        ? a.createdAt.localeCompare(b.createdAt)
        : a.expiryDate.localeCompare(b.expiryDate),
    );
  return candidates[0]?.id;
}

export interface ItemSummary {
  totalQty: number;
  expiredQty: number;
  expiringQty: number;
  status: ItemStatus;
  /** أقرب صلاحية بين التشغيلات التي بها كمية */
  nearestExpiry?: string;
}

export function summarizeItem(
  batches: ReadonlyArray<BatchLike>,
  balances: ReadonlyMap<string, number>,
  today: string,
): ItemSummary {
  let totalQty = 0;
  let expiredQty = 0;
  let expiringQty = 0;
  let nearestExpiry: string | undefined;

  for (const b of batches) {
    const qty = balances.get(b.id) ?? 0;
    if (qty <= 0) continue;
    totalQty += qty;
    const s = expiryStatus(b.expiryDate, today);
    if (s === 'expired') expiredQty += qty;
    else if (s === 'expiring_soon') expiringQty += qty;
    if (!nearestExpiry || b.expiryDate < nearestExpiry) nearestExpiry = b.expiryDate;
  }

  const status: ItemStatus =
    totalQty === 0 ? 'empty' : expiredQty > 0 ? 'expired' : expiringQty > 0 ? 'expiring_soon' : 'ok';
  return { totalQty, expiredQty, expiringQty, status, nearestExpiry };
}
