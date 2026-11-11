import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { HomePharmacyDB } from './db';

describe('ترحيل قاعدة البيانات', () => {
  it('الترقية من النسخة 1 إلى 2 تحفظ البيانات القديمة وتضيف الجداول الجديدة', async () => {
    const name = 'migration-v1-to-v2';
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
      expect.arrayContaining(['appMeta', 'households', 'profiles']),
    );
    upgraded.close();
    await Dexie.delete(name);
  });
});
