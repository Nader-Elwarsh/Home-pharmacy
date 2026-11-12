import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { UserInputError } from '../domain/errors';
import { EMPTY_BATCH_INPUT, EMPTY_ITEM_INPUT } from '../domain/inventoryRules';
import { createLocalHousehold } from './familyService';
import {
  ExpiredBatchWarning,
  createItem,
  loadItemDetail,
  recordAdjustment,
  recordPurchase,
  recordUsage,
  reverseTransaction,
} from './inventoryService';

const NOW = new Date(2026, 10, 11);
const item = (over = {}) => ({ ...EMPTY_ITEM_INPUT, tradeName: 'بنادول', unitsPerPack: '10', ...over });
const batch = (over = {}) => ({ ...EMPTY_BATCH_INPUT, expiry: '06/2027', packs: '2', ...over });
const usage = (batchId: string, over = {}) => ({
  batchId, packs: '', units: '3', type: 'consume' as const, profileId: '', note: '', opId: crypto.randomUUID(), ...over,
});

async function setup(batchOver = {}) {
  await createLocalHousehold('بيتنا');
  const id = await createItem(item(), batch(batchOver), NOW);
  const detail = await loadItemDetail(id, NOW);
  return { id, batchId: detail!.batches[0].id };
}

beforeEach(async () => {
  await db.open();
  for (const t of db.tables) await t.clear();
});

describe('حركات المخزون', () => {
  it('الاستهلاك ينقص الرصيد ويُسجَّل في الدفتر دون تعديل الحركة الأصلية', async () => {
    const { id, batchId } = await setup();
    await recordUsage(usage(batchId), NOW);
    const d = await loadItemDetail(id, NOW);
    expect(d?.batches[0].qtyBase).toBe(17);
    expect(await db.stockTransactions.count()).toBe(2);
    expect(d?.history.map((h) => h.typeLabel)).toHaveLength(2);
  });

  it('نفس opId مرتين = حركة واحدة', async () => {
    const { id, batchId } = await setup();
    const u = usage(batchId);
    await recordUsage(u, NOW);
    await recordUsage(u, NOW);
    expect((await loadItemDetail(id, NOW))?.batches[0].qtyBase).toBe(17);
    expect(await db.stockTransactions.count()).toBe(2);
  });

  it('لا يسمح برصيد سالب', async () => {
    const { id, batchId } = await setup();
    await expect(recordUsage(usage(batchId, { packs: '3', units: '' }), NOW)).rejects.toBeInstanceOf(UserInputError);
    expect((await loadItemDetail(id, NOW))?.batches[0].qtyBase).toBe(20);
    expect(await db.stockTransactions.count()).toBe(1);
  });

  it('العبوات المنتهية تطلب تأكيدًا ثم تسمح به', async () => {
    const { id, batchId } = await setup({ expiry: '01/2026' });
    await expect(recordUsage(usage(batchId), NOW)).rejects.toBeInstanceOf(ExpiredBatchWarning);
    expect((await loadItemDetail(id, NOW))?.batches[0].qtyBase).toBe(20);
    await recordUsage(usage(batchId, { allowExpired: true }), NOW);
    expect((await loadItemDetail(id, NOW))?.batches[0].qtyBase).toBe(17);
  });

  it('الجرد يتطلب سببًا ويسجل الفرق فقط', async () => {
    const { id, batchId } = await setup();
    await expect(
      recordAdjustment({ batchId, packs: '1', units: '', note: '', opId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(UserInputError);
    await recordAdjustment({ batchId, packs: '1', units: '', note: 'جرد', opId: crypto.randomUUID() });
    const d = await loadItemDetail(id, NOW);
    expect(d?.batches[0].qtyBase).toBe(10);
    const adj = (await db.stockTransactions.toArray()).find((t) => t.type === 'adjust');
    expect(adj?.qtyBaseUnits).toBe(-10);
  });

  it('إضافة كمية تزيد الرصيد', async () => {
    const { id, batchId } = await setup();
    await recordPurchase({ batchId, packs: '1', units: '', opId: crypto.randomUUID() });
    expect((await loadItemDetail(id, NOW))?.batches[0].qtyBase).toBe(30);
  });

  it('التصحيح حركة عكسية جديدة، ولا يُصحَّح مرتين', async () => {
    const { id, batchId } = await setup();
    await recordUsage(usage(batchId), NOW);
    const before = await loadItemDetail(id, NOW);
    const usageRow = before!.history.find((h) => h.typeLabel !== 'شراء' && h.reversible);
    expect(usageRow).toBeDefined();

    await reverseTransaction(usageRow!.id, crypto.randomUUID(), 'خطأ');
    const after = await loadItemDetail(id, NOW);
    expect(after?.batches[0].qtyBase).toBe(20);
    expect(await db.stockTransactions.count()).toBe(3);
    expect(after?.history.find((h) => h.id === usageRow!.id)?.reversed).toBe(true);
    await expect(reverseTransaction(usageRow!.id, crypto.randomUUID(), '')).rejects.toBeInstanceOf(UserInputError);
  });
});
