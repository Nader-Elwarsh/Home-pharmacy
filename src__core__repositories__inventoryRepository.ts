import {
  db,
  SCHEMA_VERSION,
  type BatchRecord,
  type InventoryItemRecord,
  type StockTransactionRecord,
} from '../database/db';
import type { BatchData, ItemData } from '../domain/inventoryRules';
import type { TransactionType } from '../domain/inventoryTypes';
import { balanceByBatch } from '../domain/stock';
import { checkReversal } from '../domain/stockOps';
import { nowIso, patchRecord } from './records';

export class BarcodeExistsError extends Error {
  constructor(public readonly itemName: string) {
    super('barcode-exists');
  }
}
export class ItemNotFoundError extends Error {}
export class InsufficientStockError extends Error {}
/** حركة مرفوضة لسبب قابل للعرض على المستخدم. */
export class TxRejectedError extends Error {}

function buildBatchAndPurchase(
  householdId: string,
  itemId: string,
  data: BatchData,
  now: string,
): { batch: BatchRecord; purchase: StockTransactionRecord } {
  const batch: BatchRecord = {
    id: crypto.randomUUID(),
    householdId,
    itemId,
    expiryDate: data.expiryDate,
    expiryPrecision: data.expiryPrecision,
    packState: data.packState,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  if (data.batchNo) batch.batchNo = data.batchNo;
  if (data.productionDate) batch.productionDate = data.productionDate;
  if (data.purchaseDate) batch.purchaseDate = data.purchaseDate;
  if (data.location) batch.location = data.location;

  // الكمية الابتدائية حركة شراء في الدفتر، وليست حقلًا يُعدَّل
  const purchase: StockTransactionRecord = {
    id: crypto.randomUUID(),
    householdId,
    itemId,
    batchId: batch.id,
    type: 'purchase',
    qtyBaseUnits: data.qtyBaseUnits,
    opId: crypto.randomUUID(),
    at: now,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  return { batch, purchase };
}

async function assertBarcodeFree(householdId: string, barcode: string, selfId?: string): Promise<void> {
  const dup = await db.inventoryItems
    .where('barcode')
    .equals(barcode)
    .filter((i) => i.householdId === householdId && !i.deletedAt && i.id !== selfId)
    .first();
  if (dup) throw new BarcodeExistsError(dup.tradeName);
}

export interface AppendTx {
  /** معرّف العملية: نفس المعرّف مرتين = تُنفَّذ مرة واحدة فقط */
  opId: string;
  batchId: string;
  type: Exclude<TransactionType, 'reversal'>;
  /** موجب أو سالب بالوحدة الأساسية */
  qtyBaseUnits: number;
  profileId?: string;
  note?: string;
}

export const inventoryRepository = {
  /** ينشئ الصنف وتشغيلته الأولى (إن وُجدت) وحركة الشراء في معاملة واحدة. */
  createItem(householdId: string, item: ItemData, batch?: BatchData): Promise<string> {
    return db.transaction('rw', db.inventoryItems, db.batches, db.stockTransactions, async () => {
      if (item.barcode) await assertBarcodeFree(householdId, item.barcode);

      const now = nowIso();
      const record: InventoryItemRecord = {
        ...item,
        id: crypto.randomUUID(),
        householdId,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      await db.inventoryItems.add(record);

      if (batch) {
        const built = buildBatchAndPurchase(householdId, record.id, batch, now);
        await db.batches.add(built.batch);
        await db.stockTransactions.add(built.purchase);
      }
      return record.id;
    });
  },

  updateItem(itemId: string, item: ItemData): Promise<void> {
    return db.transaction('rw', db.inventoryItems, async () => {
      const current = await db.inventoryItems.get(itemId);
      if (!current || current.deletedAt) throw new ItemNotFoundError();
      if (item.barcode) await assertBarcodeFree(current.householdId, item.barcode, itemId);
      await patchRecord(db.inventoryItems, itemId, {
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
      });
    });
  },

  setPhotoIds(itemId: string, photoIds: string[]): Promise<void> {
    return patchRecord(db.inventoryItems, itemId, { photoIds });
  },

  addBatch(itemId: string, batch: BatchData): Promise<void> {
    return db.transaction('rw', db.inventoryItems, db.batches, db.stockTransactions, async () => {
      const item = await db.inventoryItems.get(itemId);
      if (!item || item.deletedAt) throw new ItemNotFoundError();
      const built = buildBatchAndPurchase(item.householdId, itemId, batch, nowIso());
      await db.batches.add(built.batch);
      await db.stockTransactions.add(built.purchase);
    });
  },

  /**
   * يضيف حركة للدفتر ذريًا: منع التكرار بـ opId، ومنع الرصيد السالب.
   * يعيد duplicate=true إن كانت العملية نُفِّذت من قبل (لا خصم مزدوج).
   */
  appendTransaction(input: AppendTx): Promise<{ duplicate: boolean }> {
    return db.transaction('rw', db.batches, db.stockTransactions, async () => {
      const existing = await db.stockTransactions.where('opId').equals(input.opId).first();
      if (existing) return { duplicate: true };

      const batch = await db.batches.get(input.batchId);
      if (!batch || batch.deletedAt) throw new ItemNotFoundError();

      const txs = await db.stockTransactions.where('batchId').equals(input.batchId).toArray();
      const balance = balanceByBatch(txs).get(input.batchId) ?? 0;
      if (balance + input.qtyBaseUnits < 0) throw new InsufficientStockError();

      const now = nowIso();
      const rec: StockTransactionRecord = {
        id: crypto.randomUUID(),
        householdId: batch.householdId,
        itemId: batch.itemId,
        batchId: input.batchId,
        type: input.type,
        qtyBaseUnits: input.qtyBaseUnits,
        opId: input.opId,
        at: now,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      if (input.profileId) rec.profileId = input.profileId;
      if (input.note) rec.note = input.note;
      await db.stockTransactions.add(rec);
      return { duplicate: false };
    });
  },

  /** تصحيح حركة بحركة عكسية مرتبطة بها. لا تُحذف الحركة الأصلية. */
  reverseTransaction(txId: string, opId: string, note?: string): Promise<{ duplicate: boolean }> {
    return db.transaction('rw', db.batches, db.stockTransactions, async () => {
      const existing = await db.stockTransactions.where('opId').equals(opId).first();
      if (existing) return { duplicate: true };

      const tx = await db.stockTransactions.get(txId);
      if (!tx) throw new ItemNotFoundError();
      const all = await db.stockTransactions.where('batchId').equals(tx.batchId).toArray();
      const balance = balanceByBatch(all).get(tx.batchId) ?? 0;
      const check = checkReversal(tx, all, balance);
      if (!check.ok) throw new TxRejectedError(check.error);

      const now = nowIso();
      const rec: StockTransactionRecord = {
        id: crypto.randomUUID(),
        householdId: tx.householdId,
        itemId: tx.itemId,
        batchId: tx.batchId,
        type: 'reversal',
        qtyBaseUnits: check.value,
        opId,
        reversesId: tx.id,
        at: now,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      if (note) rec.note = note;
      await db.stockTransactions.add(rec);
      return { duplicate: false };
    });
  },

  async markOpened(batchId: string): Promise<void> {
    const batch = await db.batches.get(batchId);
    if (!batch || batch.deletedAt) throw new ItemNotFoundError();
    if (batch.packState !== 'sealed') return;
    await patchRecord(db.batches, batchId, { packState: 'opened', openedAt: nowIso() });
  },

  getItem(itemId: string): Promise<InventoryItemRecord | undefined> {
    return db.inventoryItems.get(itemId);
  },

  getBatch(batchId: string): Promise<BatchRecord | undefined> {
    return db.batches.get(batchId);
  },

  listItems(householdId: string): Promise<InventoryItemRecord[]> {
    return db.inventoryItems
      .where('householdId')
      .equals(householdId)
      .filter((i) => !i.deletedAt)
      .toArray();
  },

  listBatches(householdId: string): Promise<BatchRecord[]> {
    return db.batches
      .where('householdId')
      .equals(householdId)
      .filter((b) => !b.deletedAt)
      .toArray();
  },

  listBatchesForItem(itemId: string): Promise<BatchRecord[]> {
    return db.batches
      .where('itemId')
      .equals(itemId)
      .filter((b) => !b.deletedAt)
      .toArray();
  },

  listTransactions(householdId: string): Promise<StockTransactionRecord[]> {
    return db.stockTransactions.where('householdId').equals(householdId).toArray();
  },

  listTransactionsForItem(itemId: string): Promise<StockTransactionRecord[]> {
    return db.stockTransactions.where('itemId').equals(itemId).toArray();
  },

  /** أرشفة: لا يُحذف الصنف ولا حركاته. */
  async archiveItem(itemId: string): Promise<void> {
    const now = nowIso();
    await db.transaction('rw', db.inventoryItems, db.batches, async () => {
      await db.inventoryItems.update(itemId, { deletedAt: now, updatedAt: now });
      await db.batches.where('itemId').equals(itemId).modify({ deletedAt: now, updatedAt: now });
    });
  },
};
