import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { UserInputError } from '../domain/errors';
import { EMPTY_BATCH_INPUT, EMPTY_ITEM_INPUT } from '../domain/inventoryRules';
import { exportBackup, lastBackupAt, previewBackup, restoreBackup } from './backupService';
import { createLocalHousehold } from './familyService';
import { createItem, recordUsage, loadItemDetail } from './inventoryService';

const NOW = new Date(2026, 10, 11);

async function clearAll() {
  await db.open();
  for (const t of db.tables) await t.clear();
}

async function seed() {
  await createLocalHousehold('بيتنا');
  const id = await createItem({ ...EMPTY_ITEM_INPUT, tradeName: 'بنادول', unitsPerPack: '10' }, { ...EMPTY_BATCH_INPUT, expiry: '06/2027', packs: '2' }, NOW);
  const d = await loadItemDetail(id, NOW);
  await recordUsage({ batchId: d!.batches[0].id, packs: '', units: '4', type: 'consume', profileId: '', note: '', opId: crypto.randomUUID() }, NOW);
  return id;
}

async function backupFile(): Promise<File> {
  const { blob } = await exportBackup(NOW);
  return new File([await blob.text()], 'b.json', { type: 'application/json' });
}

beforeEach(clearAll);

describe('النسخ الاحتياطي', () => {
  it('التصدير ثم الاستعادة على جهاز فارغ يعيد الأصناف والرصيد', async () => {
    const id = await seed();
    const file = await backupFile();
    expect(await lastBackupAt()).toBeTruthy();

    await clearAll();
    const preview = await previewBackup(file);
    expect(preview.plan.mode).toBe('fresh');
    await restoreBackup(preview);
    expect((await loadItemDetail(id, NOW))?.batches[0].qtyBase).toBe(16);
  });

  it('الاستعادة على نفس الجهاز دمج بلا تكرار ولا تغيير', async () => {
    await seed();
    const file = await backupFile();
    const before = await db.stockTransactions.count();
    const preview = await previewBackup(file);
    expect(preview.plan.mode).toBe('merge');
    const r = await restoreBackup(preview);
    expect(r.added).toBe(0);
    expect(await db.stockTransactions.count()).toBe(before);
  });

  it('ملف غير صالح أو من منزل آخر مرفوض', async () => {
    await expect(previewBackup(new File(['not json'], 'x.json'))).rejects.toBeInstanceOf(UserInputError);
    await expect(previewBackup(new File(['{"a":1}'], 'x.json'))).rejects.toBeInstanceOf(UserInputError);

    await seed();
    const file = await backupFile();
    await clearAll();
    await createLocalHousehold('منزل آخر');
    await expect(previewBackup(file)).rejects.toBeInstanceOf(UserInputError);
  });

  it('لا تصدير بدون منزل', async () => {
    await expect(exportBackup(NOW)).rejects.toBeInstanceOf(UserInputError);
  });
});
