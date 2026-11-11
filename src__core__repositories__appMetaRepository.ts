import { db, SCHEMA_VERSION, type AppMetaRecord } from '../database/db';

function build(key: string, value: string): AppMetaRecord {
  return {
    key,
    value,
    updatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
}

export const appMetaRepository = {
  get(key: string): Promise<AppMetaRecord | undefined> {
    return db.appMeta.get(key);
  },

  async set(key: string, value: string): Promise<AppMetaRecord> {
    const record = build(key, value);
    await db.appMeta.put(record);
    return record;
  },

  /** يكتب القيمة فقط إن لم تكن موجودة، ضمن معاملة واحدة، ويعيد السجل الفعلي. */
  setIfAbsent(key: string, value: string): Promise<AppMetaRecord> {
    return db.transaction('rw', db.appMeta, async () => {
      const existing = await db.appMeta.get(key);
      if (existing) return existing;
      const record = build(key, value);
      await db.appMeta.put(record);
      return record;
    });
  },

  remove(key: string): Promise<void> {
    return db.appMeta.delete(key);
  },
};
