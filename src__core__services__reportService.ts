import { formatExpiry, todayString } from '../domain/dates';
import {
  filterReportRows,
  reportToText,
  type ReportOptions,
  type ReportRow,
  type ReportScope,
} from '../domain/report';
import { balanceByBatch, expiryStatus, formatQuantity } from '../domain/stock';
import { familyRepository } from '../repositories/familyRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';

export interface ReportData {
  householdName: string;
  dateText: string;
  rows: ReportRow[];
}

/** صف لكل عبوات فيها كمية متبقية. الصحة والكمية من المخزون الفعلي لحظة الإصدار. */
export async function loadReportRows(now: Date = new Date()): Promise<ReportData | null> {
  const h = await familyRepository.getHousehold();
  if (!h) return null;
  const today = todayString(now);
  const [items, batches, txs] = await Promise.all([
    inventoryRepository.listItems(h.id),
    inventoryRepository.listBatches(h.id),
    inventoryRepository.listTransactions(h.id),
  ]);
  const balances = balanceByBatch(txs);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const rows: ReportRow[] = [];
  for (const b of batches) {
    const item = itemById.get(b.itemId);
    const qty = balances.get(b.id) ?? 0;
    if (!item || qty <= 0) continue;
    rows.push({
      itemId: item.id,
      name: item.tradeName,
      activeIngredient: item.activeIngredient,
      strength: item.strength,
      dosageForm: item.dosageForm,
      qtyText: formatQuantity(qty, item.unitsPerPack, item.baseUnit),
      packState: b.packState,
      expiryText: formatExpiry(b.expiryDate, b.expiryPrecision),
      expiryStatus: expiryStatus(b.expiryDate, today),
      batchNo: b.batchNo,
      notes: item.notes,
      profileId: item.profileId,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return { householdName: h.name, dateText: today, rows };
}

export async function buildReportText(
  data: ReportData,
  scope: ReportScope,
  options: ReportOptions,
  profileName?: string,
): Promise<string> {
  const rows = filterReportRows(data.rows, scope);
  return reportToText(rows, { householdName: data.householdName, profileName, dateText: data.dateText }, options);
}

export { filterReportRows };
