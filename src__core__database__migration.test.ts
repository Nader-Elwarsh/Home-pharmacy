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
});
