import { PACK_STATE_LABELS, type PackState } from './inventoryTypes';
import type { ExpiryStatus } from './stock';

export interface ReportRow {
  itemId: string;
  name: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  qtyText: string;
  packState: PackState;
  expiryText: string;
  expiryStatus: ExpiryStatus;
  batchNo?: string;
  notes?: string;
  profileId?: string;
}

export interface ReportScope {
  /** فرد معين: أدويته المسجلة له فقط. بدونه = المنزل بالكامل */
  profileId?: string;
  openedOnly: boolean;
  expiringOnly: boolean;
  includeExpired: boolean;
}

export interface ReportOptions {
  includeBatchNo: boolean;
  includeNotes: boolean;
}

export const EXPIRY_STATUS_TEXT: Record<ExpiryStatus, string> = {
  ok: 'صالحة',
  expiring_soon: 'قريبة الانتهاء',
  expired: 'منتهية الصلاحية',
};

export const REPORT_DISCLAIMER =
  'الكميات حسب آخر تحديث للمخزون وقت إصدار التقرير وقد تتغير بعده. هذا التقرير للاطلاع فقط ولا يغني عن رأي الطبيب أو الصيدلي.';

export function filterReportRows(rows: ReadonlyArray<ReportRow>, scope: ReportScope): ReportRow[] {
  return rows.filter((r) => {
    if (scope.profileId && r.profileId !== scope.profileId) return false;
    if (scope.openedOnly && r.packState !== 'opened' && r.packState !== 'partial') return false;
    if (scope.expiringOnly && r.expiryStatus !== 'expiring_soon' && r.expiryStatus !== 'expired') return false;
    if (!scope.includeExpired && r.expiryStatus === 'expired') return false;
    return true;
  });
}

export interface ReportMeta {
  householdName: string;
  profileName?: string;
  dateText: string;
}

/** نص قابل للمشاركة أو النسخ (واتساب مثلًا). */
export function reportToText(
  rows: ReadonlyArray<ReportRow>,
  meta: ReportMeta,
  options: ReportOptions,
): string {
  const lines: string[] = [
    `الأدوية الموجودة لدي — ${meta.profileName ?? meta.householdName}`,
    `تاريخ الإصدار: ${meta.dateText}`,
    '',
  ];
  if (rows.length === 0) lines.push('لا توجد أدوية مطابقة.');
  rows.forEach((r, i) => {
    const head = [r.name, r.strength, r.dosageForm].filter(Boolean).join(' ');
    const parts = [`الكمية: ${r.qtyText}`, PACK_STATE_LABELS[r.packState], `الصلاحية: ${r.expiryText} (${EXPIRY_STATUS_TEXT[r.expiryStatus]})`];
    if (r.activeIngredient) parts.unshift(`المادة الفعالة: ${r.activeIngredient}`);
    if (options.includeBatchNo && r.batchNo) parts.push(`تشغيلة: ${r.batchNo}`);
    if (options.includeNotes && r.notes) parts.push(`ملاحظات: ${r.notes}`);
    lines.push(`${i + 1}. ${head}`, `   ${parts.join(' — ')}`);
  });
  lines.push('', REPORT_DISCLAIMER);
  return lines.join('\n');
}
