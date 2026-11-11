import { beforeEach, describe, expect, it } from 'vitest';
import { db, DB_NAME, HomePharmacyDB, SCHEMA_VERSION } from './db';

beforeEach(async () => {
  await db.open();
  await db.appMeta.clear();
});

describe('قاعدة البيانات المحلية', () => {
  it('تُفتح بالاسم والمخطط المتوقعين', () => {
    expect(db.name).toBe(DB_NAME);
    expect(db.tables.map((t) => t.name)).toContain('appMeta');
  });

  it('تحفظ سجلًا وتقرؤه', async () => {
    await db.appMeta.put({
      key: 'k',
      value: 'v',
      updatedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: SCHEMA_VERSION,
    });
    expect((await db.appMeta.get('k'))?.value).toBe('v');
  });

  it('لا تفقد البيانات بعد الإغلاق وإعادة الفتح', async () => {
    await db.appMeta.put({
      key: 'persist',
      value: 'yes',
      updatedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: SCHEMA_VERSION,
    });
    db.close();

    const reopened = new HomePharmacyDB();
    await reopened.open();
    expect((await reopened.appMeta.get('persist'))?.value).toBe('yes');
    reopened.close();
    await db.open();
  });
});
