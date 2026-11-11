import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { UserInputError } from '../domain/errors';
import { EMPTY_BATCH_INPUT, EMPTY_ITEM_INPUT } from '../domain/inventoryRules';
import { createLocalHousehold } from './familyService';
import {
  addBatch,
  archiveItem,
  createItem,
  loadCabinet,
  loadItemDetail,
} from './inventoryService';

const NOW = new Date(2026, 10, 11); // 2026-11-11

const item = (over = {}) => ({ ...EMPTY_ITEM_INPUT, tradeName: 'بنادول', ...over });
const batch = (over = {}) => ({ ...EMPTY_BATCH_INPUT, expiry: '06/2027', packs: '2', ...over });

beforeEach(async () => {
  await db.open();
  await db.stockTransactions.clear();
  await db.batches.clear();
  await db.inventoryItems.clear();
  await db.profiles.clear();
  await db.households.clear();
});

describe('الخزانة', () => {
  it('لا تعمل بدون منزل', async () => {
    expect(await loadCabinet(NOW)).toBeNull();
    await expect(createItem(item(), null, NOW)).rejects.toBeInstanceOf(UserInputError);
  });

  it('ينشئ صنفًا بتشغيلة وتُسجَّل الكمية كحركة شراء في الدفتر', async () => {
    await createLocalHousehold('بيتنا');
    const id = await createItem(item({ unitsPerPack: '10' }), batch({ packs: '2', units: '5' }), NOW);

    const txs = await db.stockTransactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ itemId: id, type: 'purchase', qtyBaseUnits: 25 });
    expect(txs[0].opId).toBeTruthy();

    const cabinet = await loadCabinet(NOW);
    expect(cabinet?.items).toHaveLength(1);
    expect(cabinet?.items[0].qtyText).toBe('2 عبوة و5 قرص (25 قرص)');
    expect(cabinet?.items[0].status).toBe('ok');
  });

  it('صنف بلا تشغيلة يظهر "نفد" بكمية صفر', async () => {
    await createLocalHousehold('بيتنا');
    await createItem(item(), null, NOW);
    const cabinet = await loadCabinet(NOW);
    expect(cabinet?.items[0]).toMatchObject({ status: 'empty', batchCount: 0 });
  });

  it('تعدد التشغيلات: الجمع، FEFO، حالة المنتهي', async () => {
    await createLocalHousehold('بيتنا');
    const id = await createItem(item(), batch({ expiry: '12/2027', packs: '1' }), NOW);
    await addBatch(id, batch({ expiry: '03/2027', packs: '2' }), NOW);
    await addBatch(id, batch({ expiry: '01/2026', packs: '3' }), NOW);

    const detail = await loadItemDetail(id, NOW);
    expect(detail?.totalQtyText).toBe('6 قرص');
    expect(detail?.batches.map((b) => b.expiryText)).toEqual(['01/2026', '03/2027', '12/2027']);
    expect(detail?.batches.map((b) => b.status)).toEqual(['expired', 'ok', 'ok']);
    // المنتهي لا يُقترح، والأقرب انتهاءً بين الصالح هو 03/2027
    expect(detail?.batches.map((b) => b.isFefoNext)).toEqual([false, true, false]);

    const cabinet = await loadCabinet(NOW);
    expect(cabinet?.items[0].status).toBe('expired');
  });

  it('يمنع تكرار الباركود داخل المنزل', async () => {
    await createLocalHousehold('بيتنا');
    await createItem(item({ barcode: '6221234567890' }), null, NOW);
    await expect(
      createItem(item({ tradeName: 'آخر', barcode: '٦٢٢١٢٣٤٥٦٧٨٩٠' }), null, NOW),
    ).rejects.toBeInstanceOf(UserInputError);
    expect(await db.inventoryItems.count()).toBe(1);
  });

  it('فشل التحقق من التشغيلة لا يحفظ الصنف (معاملة واحدة)', async () => {
    await createLocalHousehold('بيتنا');
    await expect(createItem(item(), batch({ expiry: 'xx' }), NOW)).rejects.toBeInstanceOf(
      UserInputError,
    );
    expect(await db.inventoryItems.count()).toBe(0);
    expect(await db.stockTransactions.count()).toBe(0);
  });

  it('الأرشفة تخفي الصنف دون حذف حركاته', async () => {
    await createLocalHousehold('بيتنا');
    const id = await createItem(item(), batch(), NOW);
    await archiveItem(id);
    expect((await loadCabinet(NOW))?.items).toEqual([]);
    expect(await loadItemDetail(id, NOW)).toBeNull();
    expect(await db.stockTransactions.count()).toBe(1);
    await expect(addBatch(id, batch(), NOW)).rejects.toBeInstanceOf(UserInputError);
  });
});
