import Dexie, { type Table } from 'dexie';
import type { ExpiryPrecision } from '../domain/dates';
import type { PackState, TransactionType } from '../domain/inventoryTypes';

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

/** تعريف الصنف عند المنزل. الكميات ليست هنا؛ هي في دفتر الحركات. catalogId لربط لاحق بالكتالوج المركزي. */
export interface InventoryItemRecord extends BaseRecord {
  tradeName: string;
  scientificName?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  /** الوحدة الأساسية (قرص، مل...) */
  baseUnit: string;
  /** عدد الوحدات الأساسية في العبوة الواحدة (معامل التحويل) */
  unitsPerPack: number;
  barcode?: string;
  notes?: string;
  catalogId?: string;
}

export interface BatchRecord extends BaseRecord {
  itemId: string;
  batchNo?: string;
  /** YYYY-MM-DD (إن كانت الدقة شهرًا فهو آخر يوم في الشهر) */
  expiryDate: string;
  expiryPrecision: ExpiryPrecision;
  purchaseDate?: string;
  /** مكان التخزين كنص حر في هذه المرحلة */
  location?: string;
  packState: PackState;
}

/** دفتر الحركات: للإضافة فقط. الرصيد = مجموع qtyBaseUnits لكل تشغيلة. */
export interface StockTransactionRecord extends BaseRecord {
  itemId: string;
  batchId: string;
  type: TransactionType;
  /** موجب للإضافة، سالب للصرف، بالوحدة الأساسية */
  qtyBaseUnits: number;
  /** معرّف عملية فريد لمنع التكرار عند إعادة الإرسال */
  opId: string;
  reversesId?: string;
  note?: string;
  /** وقت الحركة UTC ISO */
  at: string;
}

export class HomePharmacyDB extends Dexie {
  appMeta!: Table<AppMetaRecord, string>;
  households!: Table<HouseholdRecord, string>;
  profiles!: Table<ProfileRecord, string>;
  inventoryItems!: Table<InventoryItemRecord, string>;
  batches!: Table<BatchRecord, string>;
  stockTransactions!: Table<StockTransactionRecord, string>;

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
    this.version(3).stores({
      appMeta: 'key',
      households: 'id',
      profiles: 'id, householdId, createdAt',
      inventoryItems: 'id, householdId, barcode, createdAt',
      batches: 'id, householdId, itemId, expiryDate',
      stockTransactions: 'id, householdId, batchId, itemId, &opId, at',
    });
  }
}

export const db = new HomePharmacyDB();
