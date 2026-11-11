import {
  db,
  SCHEMA_VERSION,
  type BatchRecord,
  type InventoryItemRecord,
  type StockTransactionRecord,
} from '../database/db';
import type { BatchData, ItemData } from '../domain/inventoryRules';

export class BarcodeExistsError extends Error {
  constructor(public readonly itemName: string) {
    super('barcode-exists');
  }
}
export class ItemNotFoundError extends Error {}

function nowIso(): string {
  return new Date().toISOString();
}

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

export const inventoryRepository = {
  /** ينشئ الصنف وتشغيلته الأولى (إن وُجدت) وحركة الشراء في معاملة واحدة. */
  createItem(householdId: string, item: ItemData, batch?: BatchData): Promise<string> {
    return db.transaction('rw', db.inventoryItems, db.batches, db.stockTransactions, async () => {
      if (item.barcode) {
        const dup = await db.inventoryItems
          .where('barcode')
          .equals(item.barcode)
          .filter((i) => i.householdId === householdId && !i.deletedAt)
          .first();
        if (dup) throw new BarcodeExistsError(dup.tradeName);
      }

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

  addBatch(itemId: string, batch: BatchData): Promise<void> {
    return db.transaction('rw', db.inventoryItems, db.batches, db.stockTransactions, async () => {
      const item = await db.inventoryItems.get(itemId);
      if (!item || item.deletedAt) throw new ItemNotFoundError();
      const built = buildBatchAndPurchase(item.householdId, itemId, batch, nowIso());
      await db.batches.add(built.batch);
      await db.stockTransactions.add(built.purchase);
    });
  },

  getItem(itemId: string): Promise<InventoryItemRecord | undefined> {
    return db.inventoryItems.get(itemId);
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
