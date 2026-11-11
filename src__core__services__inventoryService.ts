import { formatExpiry, todayString } from '../domain/dates';
import { UserInputError } from '../domain/errors';
import {
  matchesQuery,
  validateBatch,
  validateItem,
  type BatchInput,
  type ItemInput,
} from '../domain/inventoryRules';
import type { PackState } from '../domain/inventoryTypes';
import {
  balanceByBatch,
  daysUntilExpiry,
  expiryStatus,
  fefoNextBatchId,
  formatQuantity,
  summarizeItem,
  type ExpiryStatus,
  type ItemStatus,
} from '../domain/stock';
import { familyRepository } from '../repositories/familyRepository';
import {
  BarcodeExistsError,
  inventoryRepository,
  ItemNotFoundError,
} from '../repositories/inventoryRepository';

export { toUserMessage } from './familyService';
export { matchesQuery };

export interface ItemRow {
  id: string;
  tradeName: string;
  strength?: string;
  dosageForm?: string;
  barcode?: string;
  scientificName?: string;
  activeIngredient?: string;
  qtyText: string;
  status: ItemStatus;
  nearestExpiryText?: string;
  batchCount: number;
}

export interface CabinetData {
  householdName: string;
  items: ItemRow[];
}

export interface BatchRow {
  id: string;
  batchNo?: string;
  expiryText: string;
  status: ExpiryStatus;
  daysLeft: number;
  qtyText: string;
  empty: boolean;
  packState: PackState;
  location?: string;
  purchaseDate?: string;
  isFefoNext: boolean;
}

export interface ItemDetail {
  id: string;
  tradeName: string;
  scientificName?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  baseUnit: string;
  unitsPerPack: number;
  barcode?: string;
  notes?: string;
  totalQtyText: string;
  batches: BatchRow[];
}

/** يعيد null إن لم يُنشأ المنزل بعد. */
export async function loadCabinet(now: Date = new Date()): Promise<CabinetData | null> {
  const household = await familyRepository.getHousehold();
  if (!household) return null;
  const today = todayString(now);

  const [items, batches, txs] = await Promise.all([
    inventoryRepository.listItems(household.id),
    inventoryRepository.listBatches(household.id),
    inventoryRepository.listTransactions(household.id),
  ]);
  const balances = balanceByBatch(txs);

  const rows: ItemRow[] = items.map((item) => {
    const itemBatches = batches.filter((b) => b.itemId === item.id);
    const summary = summarizeItem(itemBatches, balances, today);
    const nearest = summary.nearestExpiry
      ? itemBatches.find((b) => b.expiryDate === summary.nearestExpiry)
      : undefined;
    return {
      id: item.id,
      tradeName: item.tradeName,
      strength: item.strength,
      dosageForm: item.dosageForm,
      barcode: item.barcode,
      scientificName: item.scientificName,
      activeIngredient: item.activeIngredient,
      qtyText: formatQuantity(summary.totalQty, item.unitsPerPack, item.baseUnit),
      status: summary.status,
      nearestExpiryText:
        nearest && summary.nearestExpiry
          ? formatExpiry(summary.nearestExpiry, nearest.expiryPrecision)
          : undefined,
      batchCount: itemBatches.length,
    };
  });
  rows.sort((a, b) => a.tradeName.localeCompare(b.tradeName, 'ar'));
  return { householdName: household.name, items: rows };
}

export async function loadItemDetail(
  itemId: string,
  now: Date = new Date(),
): Promise<ItemDetail | null> {
  const item = await inventoryRepository.getItem(itemId);
  if (!item || item.deletedAt) return null;
  const today = todayString(now);

  const [batches, txs] = await Promise.all([
    inventoryRepository.listBatchesForItem(itemId),
    inventoryRepository.listTransactionsForItem(itemId),
  ]);
  const balances = balanceByBatch(txs);
  const fefoId = fefoNextBatchId(batches, balances, today);
  const total = batches.reduce((sum, b) => sum + (balances.get(b.id) ?? 0), 0);

  const rows: BatchRow[] = [...batches]
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    .map((b) => {
      const qty = balances.get(b.id) ?? 0;
      return {
        id: b.id,
        batchNo: b.batchNo,
        expiryText: formatExpiry(b.expiryDate, b.expiryPrecision),
        status: expiryStatus(b.expiryDate, today),
        daysLeft: daysUntilExpiry(b.expiryDate, today),
        qtyText: formatQuantity(qty, item.unitsPerPack, item.baseUnit),
        empty: qty <= 0,
        packState: b.packState,
        location: b.location,
        purchaseDate: b.purchaseDate,
        isFefoNext: b.id === fefoId,
      };
    });

  return {
    id: item.id,
    tradeName: item.tradeName,
    scientificName: item.scientificName,
    activeIngredient: item.activeIngredient,
    strength: item.strength,
    dosageForm: item.dosageForm,
    baseUnit: item.baseUnit,
    unitsPerPack: item.unitsPerPack,
    barcode: item.barcode,
    notes: item.notes,
    totalQtyText: formatQuantity(total, item.unitsPerPack, item.baseUnit),
    batches: rows,
  };
}

/** ينشئ صنفًا، ومعه تشغيلته الأولى إن مُرِّرت. يعيد معرّف الصنف. */
export async function createItem(
  itemInput: ItemInput,
  batchInput: BatchInput | null,
  now: Date = new Date(),
): Promise<string> {
  const household = await familyRepository.getHousehold();
  if (!household) throw new UserInputError('أنشئ المنزل أولًا من صفحة الأسرة');

  const item = validateItem(itemInput);
  if (!item.ok) throw new UserInputError(item.error);

  let batch;
  if (batchInput) {
    const checked = validateBatch(batchInput, item.value.unitsPerPack, todayString(now));
    if (!checked.ok) throw new UserInputError(checked.error);
    batch = checked.value;
  }

  try {
    return await inventoryRepository.createItem(household.id, item.value, batch);
  } catch (e) {
    if (e instanceof BarcodeExistsError) {
      throw new UserInputError(`هذا الباركود مسجل مسبقًا للصنف "${e.itemName}"`);
    }
    throw e;
  }
}

export async function addBatch(
  itemId: string,
  batchInput: BatchInput,
  now: Date = new Date(),
): Promise<void> {
  const item = await inventoryRepository.getItem(itemId);
  if (!item || item.deletedAt) throw new UserInputError('الصنف غير موجود');

  const checked = validateBatch(batchInput, item.unitsPerPack, todayString(now));
  if (!checked.ok) throw new UserInputError(checked.error);

  try {
    await inventoryRepository.addBatch(itemId, checked.value);
  } catch (e) {
    if (e instanceof ItemNotFoundError) throw new UserInputError('الصنف غير موجود');
    throw e;
  }
}

export function archiveItem(itemId: string): Promise<void> {
  return inventoryRepository.archiveItem(itemId);
}
