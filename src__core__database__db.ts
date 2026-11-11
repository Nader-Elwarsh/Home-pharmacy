import Dexie, { type Table } from 'dexie';

export const DB_NAME = 'home-pharmacy';
/** نسخة مخطط السجلات (schemaVersion داخل كل سجل). */
export const SCHEMA_VERSION = 1;

/** سجل إعدادات/بيانات وصفية للتطبيق على هذا الجهاز. */
export interface AppMetaRecord {
  key: string;
  value: string;
  /** UTC ISO */
  updatedAt: string;
  schemaVersion: number;
}

/** الحقول المشتركة لكل سجل تابع لمنزل. التواريخ UTC ISO. الحذف = أرشفة بـ deletedAt. */
export interface BaseRecord {
  id: string;
  householdId: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface HouseholdRecord {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRecord extends BaseRecord {
  name: string;
  /** YYYY-MM-DD، اختياري */
  birthDate?: string;
}

export class HomePharmacyDB extends Dexie {
  appMeta!: Table<AppMetaRecord, string>;
  households!: Table<HouseholdRecord, string>;
  profiles!: Table<ProfileRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    // كل تعديل لاحق على المخطط = version جديدة (لا تعدّل version قائمة).
    this.version(1).stores({
      appMeta: 'key',
    });
    this.version(2).stores({
      appMeta: 'key',
      households: 'id',
      profiles: 'id, householdId, createdAt',
    });
  }
}

export const db = new HomePharmacyDB();
