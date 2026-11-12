import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { HomePharmacyDB } from './db';

describe('ترحيل قاعدة البيانات', () => {
  it('الترقية من النسخة 1 إلى الأحدث تحفظ البيانات القديمة وتضيف الجداول الجديدة', async () => {
    const name = 'migration-v1-to-latest';
    await Dexie.delete(name);

    const old = new Dexie(name);
    old.version(1).stores({ appMeta: 'key' });
    await old.open();
    await old.table('appMeta').put({
      key: 'firstOpenAt',
      value: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 1,
    });
    old.close();

    const upgraded = new HomePharmacyDB(name);
    await upgraded.open();
    expect((await upgraded.appMeta.get('firstOpenAt'))?.value).toBe('2026-01-01T00:00:00.000Z');
    expect(upgraded.tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'appMeta',
        'households',
        'profiles',
        'inventoryItems',
        'batches',
        'stockTransactions',
      ]),
    );
    upgraded.close();
    await Dexie.delete(name);
  });

  it('الترقية من النسخة 2 (الأسرة) تحفظ المنازل والأفراد', async () => {
    const name = 'migration-v2-to-latest';
    await Dexie.delete(name);

    const v2 = new Dexie(name);
    v2.version(2).stores({
      appMeta: 'key',
      households: 'id',
      profiles: 'id, householdId, createdAt',
    });
    await v2.open();
    await v2.table('households').put({
      id: 'h1',
      name: 'بيتنا',
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await v2.table('profiles').put({
      id: 'p1',
      householdId: 'h1',
      name: 'أحمد',
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    v2.close();

    const upgraded = new HomePharmacyDB(name);
    await upgraded.open();
    expect((await upgraded.households.get('h1'))?.name).toBe('بيتنا');
    expect((await upgraded.profiles.get('p1'))?.name).toBe('أحمد');
    expect(await upgraded.inventoryItems.count()).toBe(0);
    upgraded.close();
    await Dexie.delete(name);
  });
  it('الترقية من النسخة 3 (المخزون) إلى 4 تحفظ الأصناف والحركات وتضيف جداول الصحة', async () => {
    const name = 'migration-v3-to-latest';
    await Dexie.delete(name);

    const v3 = new Dexie(name);
    v3.version(3).stores({
      appMeta: 'key',
      households: 'id',
      profiles: 'id, householdId, createdAt',
      inventoryItems: 'id, householdId, barcode, createdAt',
      batches: 'id, householdId, itemId, expiryDate',
      stockTransactions: 'id, householdId, batchId, itemId, &opId, at',
    });
    await v3.open();
    const ts = '2026-01-01T00:00:00.000Z';
    await v3.table('inventoryItems').put({
      id: 'i1', householdId: 'h1', tradeName: 'بنادول', baseUnit: 'قرص', unitsPerPack: 10,
      schemaVersion: 1, createdAt: ts, updatedAt: ts,
    });
    await v3.table('stockTransactions').put({
      id: 't1', householdId: 'h1', itemId: 'i1', batchId: 'b1', type: 'purchase', qtyBaseUnits: 10,
      opId: 'op1', at: ts, schemaVersion: 1, createdAt: ts, updatedAt: ts,
    });
    v3.close();

    const upgraded = new HomePharmacyDB(name);
    await upgraded.open();
    expect((await upgraded.inventoryItems.get('i1'))?.tradeName).toBe('بنادول');
    expect((await upgraded.stockTransactions.get('t1'))?.qtyBaseUnits).toBe(10);
    expect(upgraded.tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['attachments', 'contacts', 'visits', 'documents', 'prescriptions', 'treatments', 'doseLogs', 'appointments', 'careTasks', 'shoppingItems']),
    );
    upgraded.close();
    await Dexie.delete(name);
  });
});
