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
import { canReverse, checkWithdrawal, parseQuantity, adjustmentDelta, TX_LABELS } from '../domain/stockOps';
import { familyRepository } from '../repositories/familyRepository';
import {
  BarcodeExistsError,
  InsufficientStockError,
  inventoryRepository,
  ItemNotFoundError,
  TxRejectedError,
} from '../repositories/inventoryRepository';
import { saveFiles, removeAttachment } from './attachmentService';
import { nameMap, requireHousehold } from './common';

export { toUserMessage } from './familyService';
export { matchesQuery };

/** تحذير يطلب تأكيد المستخدم: العبوات منتهية الصلاحية. */
export class ExpiredBatchWarning extends UserInputError {}

export interface ItemRow {
  id: string;
  tradeName: string;
  strength?: string;
  dosageForm?: string;
  barcode?: string;
  scientificName?: string;
  activeIngredient?: string;
  profileName?: string;
  photoId?: string;
  qtyText: string;
  status: ItemStatus;
  lowStock: boolean;
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
  productionDate?: string;
  expiryText: string;
  status: ExpiryStatus;
  daysLeft: number;
  qtyText: string;
  qtyBase: number;
  empty: boolean;
  packState: PackState;
  openedAt?: string;
  location?: string;
  purchaseDate?: string;
  isFefoNext: boolean;
}

export interface HistoryRow {
  id: string;
  at: string;
  typeLabel: string;
  qtyText: string;
  batchLabel: string;
  note?: string;
  profileName?: string;
  /** يمكن تصحيحها بحركة عكسية */
  reversible: boolean;
  reversed: boolean;
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
  lowStockAt?: number;
  profileId?: string;
  profileName?: string;
  photoIds: string[];
  totalQtyText: string;
  batches: BatchRow[];
  history: HistoryRow[];
}

/** يعيد null إن لم يُنشأ المنزل بعد. */
export async function loadCabinet(now: Date = new Date()): Promise<CabinetData | null> {
  const household = await familyRepository.getHousehold();
  if (!household) return null;
  const today = todayString(now);

  const [items, batches, txs, profiles] = await Promise.all([
    inventoryRepository.listItems(household.id),
    inventoryRepository.listBatches(household.id),
    inventoryRepository.listTransactions(household.id),
    familyRepository.listProfiles(household.id),
  ]);
  const balances = balanceByBatch(txs);
  const names = nameMap(profiles);

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
      profileName: item.profileId ? names.get(item.profileId) : undefined,
      photoId: item.photoIds?.[0],
      qtyText: formatQuantity(summary.totalQty, item.unitsPerPack, item.baseUnit),
      status: summary.status,
      lowStock:
        item.lowStockAt !== undefined && summary.totalQty > 0 && summary.totalQty <= item.lowStockAt,
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

function signedQty(qty: number, unitsPerPack: number, baseUnit: string): string {
  const text = formatQuantity(Math.abs(qty), unitsPerPack, baseUnit);
  return qty < 0 ? `−${text}` : `+${text}`;
}

export async function loadItemDetail(
  itemId: string,
  now: Date = new Date(),
): Promise<ItemDetail | null> {
  const item = await inventoryRepository.getItem(itemId);
  if (!item || item.deletedAt) return null;
  const today = todayString(now);

  const [batches, txs, profiles] = await Promise.all([
    inventoryRepository.listBatchesForItem(itemId),
    inventoryRepository.listTransactionsForItem(itemId),
    familyRepository.listProfiles(item.householdId),
  ]);
  const balances = balanceByBatch(txs);
  const fefoId = fefoNextBatchId(batches, balances, today);
  const total = batches.reduce((sum, b) => sum + (balances.get(b.id) ?? 0), 0);
  const names = nameMap(profiles);
  const batchById = new Map(batches.map((b) => [b.id, b]));

  const rows: BatchRow[] = [...batches]
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    .map((b) => {
      const qty = balances.get(b.id) ?? 0;
      return {
        id: b.id,
        batchNo: b.batchNo,
        productionDate: b.productionDate,
        expiryText: formatExpiry(b.expiryDate, b.expiryPrecision),
        status: expiryStatus(b.expiryDate, today),
        daysLeft: daysUntilExpiry(b.expiryDate, today),
        qtyText: formatQuantity(qty, item.unitsPerPack, item.baseUnit),
        qtyBase: qty,
        empty: qty <= 0,
        packState: b.packState,
        openedAt: b.openedAt,
        location: b.location,
        purchaseDate: b.purchaseDate,
        isFefoNext: b.id === fefoId,
      };
    });

  const history: HistoryRow[] = [...txs]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((t) => {
      const batch = batchById.get(t.batchId);
      const sameBatchTxs = txs.filter((x) => x.batchId === t.batchId);
      return {
        id: t.id,
        at: t.at,
        typeLabel: TX_LABELS[t.type],
        qtyText: signedQty(t.qtyBaseUnits, item.unitsPerPack, item.baseUnit),
        batchLabel: batch ? formatExpiry(batch.expiryDate, batch.expiryPrecision) : '—',
        note: t.note,
        profileName: t.profileId ? names.get(t.profileId) : undefined,
        reversible: canReverse(t, sameBatchTxs).ok,
        reversed: sameBatchTxs.some((x) => x.reversesId === t.id),
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
    lowStockAt: item.lowStockAt,
    profileId: item.profileId,
    profileName: item.profileId ? names.get(item.profileId) : undefined,
    photoIds: item.photoIds ?? [],
    totalQtyText: formatQuantity(total, item.unitsPerPack, item.baseUnit),
    batches: rows,
    history,
  };
}

/** بيانات الصنف كنصوص لنموذج التعديل. */
export async function loadItemInput(itemId: string): Promise<ItemInput | null> {
  const item = await inventoryRepository.getItem(itemId);
  if (!item || item.deletedAt) return null;
  return {
    tradeName: item.tradeName,
    scientificName: item.scientificName ?? '',
    activeIngredient: item.activeIngredient ?? '',
    strength: item.strength ?? '',
    dosageForm: item.dosageForm ?? '',
    baseUnit: item.baseUnit,
    unitsPerPack: String(item.unitsPerPack),
    barcode: item.barcode ?? '',
    notes: item.notes ?? '',
    lowStockAt: item.lowStockAt !== undefined ? String(item.lowStockAt) : '',
    profileId: item.profileId ?? '',
  };
}

function mapRepoError(e: unknown): never {
  if (e instanceof BarcodeExistsError) {
    throw new UserInputError(`هذا الباركود مسجل مسبقًا للصنف "${e.itemName}"`);
  }
  if (e instanceof ItemNotFoundError) throw new UserInputError('الصنف أو العبوات غير موجودة');
  if (e instanceof InsufficientStockError) {
    throw new UserInputError('الكمية المطلوبة أكبر من المتاح في هذه العبوات');
  }
  if (e instanceof TxRejectedError) throw new UserInputError(e.message);
  throw e;
}

/** ينشئ صنفًا، ومعه تشغيلته الأولى إن مُرِّرت. يعيد معرّف الصنف. */
export async function createItem(
  itemInput: ItemInput,
  batchInput: BatchInput | null,
  now: Date = new Date(),
): Promise<string> {
  const household = await requireHousehold();

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
    return mapRepoError(e);
  }
}

export async function updateItem(itemId: string, itemInput: ItemInput): Promise<void> {
  const item = validateItem(itemInput);
  if (!item.ok) throw new UserInputError(item.error);
  try {
    await inventoryRepository.updateItem(itemId, item.value);
  } catch (e) {
    mapRepoError(e);
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
    mapRepoError(e);
  }
}

export function archiveItem(itemId: string): Promise<void> {
  return inventoryRepository.archiveItem(itemId);
}

// ===== حركات المخزون =====

async function loadBatchContext(batchId: string) {
  const batch = await inventoryRepository.getBatch(batchId);
  if (!batch || batch.deletedAt) throw new UserInputError('العبوات غير موجودة');
  const item = await inventoryRepository.getItem(batch.itemId);
  if (!item || item.deletedAt) throw new UserInputError('الصنف غير موجود');
  const txs = await inventoryRepository.listTransactionsForItem(item.id);
  const balance = balanceByBatch(txs).get(batchId) ?? 0;
  return { batch, item, balance };
}

export interface UsageParams {
  batchId: string;
  packs: string;
  units: string;
  type: 'consume' | 'dispense';
  profileId: string;
  note: string;
  /** يُولَّد مرة لكل نموذج: ضغطتان متتاليتان = حركة واحدة */
  opId: string;
  allowExpired?: boolean;
}

/** استهلاك أو صرف من عبوات معينة. لا يسمح برصيد سالب. */
export async function recordUsage(p: UsageParams, now: Date = new Date()): Promise<void> {
  const { batch, item, balance } = await loadBatchContext(p.batchId);
  const qty = parseQuantity(p.packs, p.units, item.unitsPerPack);
  if (!qty.ok) throw new UserInputError(qty.error);
  const guard = checkWithdrawal(balance, qty.value);
  if (!guard.ok) throw new UserInputError(guard.error);

  if (!p.allowExpired && expiryStatus(batch.expiryDate, todayString(now)) === 'expired') {
    throw new ExpiredBatchWarning('هذه العبوات منتهية الصلاحية. هل تريد تسجيل الاستخدام رغم ذلك؟');
  }
  try {
    await inventoryRepository.appendTransaction({
      opId: p.opId,
      batchId: p.batchId,
      type: p.type,
      qtyBaseUnits: -qty.value,
      profileId: p.profileId.trim() || undefined,
      note: p.note.trim() || undefined,
    });
  } catch (e) {
    mapRepoError(e);
  }
}

export interface AddStockParams {
  batchId: string;
  packs: string;
  units: string;
  opId: string;
}

/** إضافة كمية إلى عبوات موجودة بنفس تاريخ الصلاحية. */
export async function recordPurchase(p: AddStockParams): Promise<void> {
  const { item } = await loadBatchContext(p.batchId);
  const qty = parseQuantity(p.packs, p.units, item.unitsPerPack);
  if (!qty.ok) throw new UserInputError(qty.error);
  if (qty.value <= 0) throw new UserInputError('أدخل كمية أكبر من صفر');
  try {
    await inventoryRepository.appendTransaction({
      opId: p.opId,
      batchId: p.batchId,
      type: 'purchase',
      qtyBaseUnits: qty.value,
    });
  } catch (e) {
    mapRepoError(e);
  }
}

export interface AdjustParams extends AddStockParams {
  /** سبب التسوية: إلزامي لأنه يغيّر الرصيد دون استهلاك */
  note: string;
}

/** تسوية جرد: تدخل الكمية الموجودة فعلًا، ويُسجَّل الفرق حركة مع السبب. */
export async function recordAdjustment(p: AdjustParams): Promise<void> {
  const { item, balance } = await loadBatchContext(p.batchId);
  const note = p.note.trim();
  if (note === '') throw new UserInputError('اكتب سبب التسوية (مثل: جرد، تلف، فقد)');
  const counted = parseQuantity(p.packs, p.units, item.unitsPerPack);
  if (!counted.ok) throw new UserInputError(counted.error);
  const delta = adjustmentDelta(balance, counted.value);
  if (delta === 0) throw new UserInputError('الكمية المعدودة تساوي الرصيد الحالي');
  try {
    await inventoryRepository.appendTransaction({
      opId: p.opId,
      batchId: p.batchId,
      type: 'adjust',
      qtyBaseUnits: delta,
      note,
    });
  } catch (e) {
    mapRepoError(e);
  }
}

export async function reverseTransaction(txId: string, opId: string, note: string): Promise<void> {
  try {
    await inventoryRepository.reverseTransaction(txId, opId, note.trim() || undefined);
  } catch (e) {
    mapRepoError(e);
  }
}

export async function markOpened(batchId: string): Promise<void> {
  try {
    await inventoryRepository.markOpened(batchId);
  } catch (e) {
    mapRepoError(e);
  }
}

export async function setItemPhotos(itemId: string, photoIds: string[]): Promise<void> {
  await inventoryRepository.setPhotoIds(itemId, photoIds);
}

/** الكمية الإجمالية لكل صنف (بالوحدة الأساسية). */
export async function loadItemTotals(householdId: string): Promise<Map<string, number>> {
  const [batches, txs] = await Promise.all([
    inventoryRepository.listBatches(householdId),
    inventoryRepository.listTransactions(householdId),
  ]);
  const balances = balanceByBatch(txs);
  const totals = new Map<string, number>();
  for (const b of batches) totals.set(b.itemId, (totals.get(b.itemId) ?? 0) + (balances.get(b.id) ?? 0));
  return totals;
}

/** يحفظ صور الدواء ويضيفها لقائمة صور الصنف. */
export async function addItemPhotos(itemId: string, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const item = await inventoryRepository.getItem(itemId);
  if (!item || item.deletedAt) throw new UserInputError('الصنف غير موجود');
  const current = item.photoIds ?? [];
  if (current.length + files.length > 5) throw new UserInputError('الحد الأقصى 5 صور للدواء الواحد');
  const ids = await saveFiles(files, 'item', itemId);
  await inventoryRepository.setPhotoIds(itemId, [...current, ...ids]);
}

export async function removeItemPhoto(itemId: string, photoId: string): Promise<void> {
  const item = await inventoryRepository.getItem(itemId);
  if (!item) return;
  await inventoryRepository.setPhotoIds(itemId, (item.photoIds ?? []).filter((x) => x !== photoId));
  await removeAttachment(photoId);
}
