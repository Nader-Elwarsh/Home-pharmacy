import type { StatusKind } from '@/components/StatusBadge';
import type { ExpiryStatus, ItemStatus } from '@/core/domain/stock';

export const ITEM_STATUS: Record<ItemStatus, { kind: StatusKind; label: string }> = {
  ok: { kind: 'ok', label: 'سليم' },
  expiring_soon: { kind: 'warning', label: 'قريب الانتهاء' },
  expired: { kind: 'danger', label: 'يوجد منتهي الصلاحية' },
  empty: { kind: 'info', label: 'نفد' },
};

export function batchStatus(
  status: ExpiryStatus,
  daysLeft: number,
  empty: boolean,
): { kind: StatusKind; label: string } {
  if (empty) return { kind: 'info', label: 'فارغة' };
  if (status === 'expired') return { kind: 'danger', label: `منتهية منذ ${Math.abs(daysLeft)} يومًا` };
  if (status === 'expiring_soon') {
    return { kind: 'warning', label: daysLeft === 0 ? 'تنتهي اليوم' : `تنتهي بعد ${daysLeft} يومًا` };
  }
  return { kind: 'ok', label: 'صالحة' };
}
