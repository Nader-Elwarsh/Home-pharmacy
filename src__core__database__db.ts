import Dexie, { type Table } from 'dexie';

export const DB_NAME = 'home-pharmacy';
export const SCHEMA_VERSION = 1;

/** سجل إعدادات/بيانات وصفية للتطبيق على هذا الجهاز. */
export interface AppMetaRecord {
  key: string;
  value: string;
  /** UTC ISO */
  updatedAt: string;
  schemaVersion: number;
}

export class HomePharmacyDB extends Dexie {
  appMeta!: Table<AppMetaRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    // كل تعديل لاحق على المخطط = version جديدة مع upgrade (انظر P2).
    this.version(1).stores({
      appMeta: 'key',
    });
  }
}

export const db = new HomePharmacyDB();
