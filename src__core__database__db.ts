import Dexie, { type Table } from 'dexie';
import type { ExpiryPrecision } from '../domain/dates';
import type {
  ApptKind,
  ContactKind,
  DispenseStatus,
  DocKind,
  Priority,
  TreatmentStatus,
} from '../domain/healthRules';
import type { PackState, TransactionType } from '../domain/inventoryTypes';
import type { DoseStatus } from '../domain/schedule';

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
  /** الدواء لفرد معين (اختياري؛ بدونه المخزون مشترك) */
  profileId?: string;
  /** حد التنبيه بانخفاض الكمية بالوحدة الأساسية */
  lowStockAt?: number;
  /** معرّفات صور العبوة في جدول attachments */
  photoIds?: string[];
}

export interface BatchRecord extends BaseRecord {
  itemId: string;
  batchNo?: string;
  /** YYYY-MM-DD */
  productionDate?: string;
  /** YYYY-MM-DD (إن كانت الدقة شهرًا فهو آخر يوم في الشهر) */
  expiryDate: string;
  expiryPrecision: ExpiryPrecision;
  purchaseDate?: string;
  /** وقت فتح العبوة UTC ISO */
  openedAt?: string;
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
  /** الفرد المستفيد عند الاستهلاك/الصرف (اختياري) */
  profileId?: string;
  note?: string;
  /** وقت الحركة UTC ISO */
  at: string;
}

export type AttachmentOwnerType = 'item' | 'document' | 'prescription';

export interface AttachmentRecord extends BaseRecord {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  kind: 'image' | 'pdf';
  mime: string;
  name: string;
  size: number;
  blob: Blob;
}

export interface ContactRecord extends BaseRecord {
  kind: ContactKind;
  name: string;
  specialty?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  hours?: string;
  fee?: string;
  mapUrl?: string;
  delivery: boolean;
  notes?: string;
  favorite: boolean;
}

export interface VisitRecord extends BaseRecord {
  profileId: string;
  date: string;
  contactId?: string;
  reason?: string;
  notes?: string;
}

export interface DocumentRecord extends BaseRecord {
  profileId: string;
  kind: DocKind;
  title: string;
  date: string;
  facility?: string;
  contactId?: string;
  visitId?: string;
  notes?: string;
  tags?: string;
  attachmentIds: string[];
}

export interface PrescriptionRecord extends BaseRecord {
  profileId: string;
  date: string;
  contactId?: string;
  visitId?: string;
  reason?: string;
  notes?: string;
  attachmentIds: string[];
}

export interface PrescriptionItemRecord extends BaseRecord {
  prescriptionId: string;
  writtenName: string;
  /** ربط يختاره المستخدم بدواء من الخزانة؛ لا مطابقة تلقائية */
  itemId?: string;
  strength?: string;
  qty?: string;
  instructions?: string;
  duration?: string;
  dispenseStatus: DispenseStatus;
}

export interface TreatmentRecord extends BaseRecord {
  profileId: string;
  name: string;
  startDate: string;
  endDate?: string;
  contactId?: string;
  prescriptionId?: string;
  notes?: string;
  status: TreatmentStatus;
}

/** دواء ضمن علاج. المواعيد أدخلها المستخدم بنفسه، ولا يُنشأ جدول تلقائيًا. */
export interface TreatmentItemRecord extends BaseRecord {
  treatmentId: string;
  profileId: string;
  name: string;
  itemId?: string;
  instructions?: string;
  times: string[];
}

/** تسجيل جرعة. منفصل تمامًا عن حركات المخزون: تسجيل الجرعة لا يخصم شيئًا. */
export interface DoseLogRecord extends BaseRecord {
  treatmentItemId: string;
  treatmentId: string;
  profileId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  /** مفتاح فريد للموعد: itemId|date|time */
  slotKey: string;
  status: DoseStatus;
  reason?: string;
}

export interface AppointmentRecord extends BaseRecord {
  profileId: string;
  kind: ApptKind;
  title: string;
  date: string;
  time?: string;
  contactId?: string;
  notes?: string;
  status: 'upcoming' | 'done' | 'cancelled';
}

export interface CareTaskRecord extends BaseRecord {
  title: string;
  profileId?: string;
  dueDate?: string;
  status: 'open' | 'done';
  doneAt?: string;
}

export interface ShoppingItemRecord extends BaseRecord {
  name: string;
  qty?: string;
  profileId?: string;
  priority: Priority;
  reason?: string;
  itemId?: string;
  status: 'pending' | 'bought';
}

export class HomePharmacyDB extends Dexie {
  appMeta!: Table<AppMetaRecord, string>;
  households!: Table<HouseholdRecord, string>;
  profiles!: Table<ProfileRecord, string>;
  inventoryItems!: Table<InventoryItemRecord, string>;
  batches!: Table<BatchRecord, string>;
  stockTransactions!: Table<StockTransactionRecord, string>;
  attachments!: Table<AttachmentRecord, string>;
  contacts!: Table<ContactRecord, string>;
  visits!: Table<VisitRecord, string>;
  documents!: Table<DocumentRecord, string>;
  prescriptions!: Table<PrescriptionRecord, string>;
  prescriptionItems!: Table<PrescriptionItemRecord, string>;
  treatments!: Table<TreatmentRecord, string>;
  treatmentItems!: Table<TreatmentItemRecord, string>;
  doseLogs!: Table<DoseLogRecord, string>;
  appointments!: Table<AppointmentRecord, string>;
  careTasks!: Table<CareTaskRecord, string>;
  shoppingItems!: Table<ShoppingItemRecord, string>;

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
    this.version(4).stores({
      appMeta: 'key',
      households: 'id',
      profiles: 'id, householdId, createdAt',
      inventoryItems: 'id, householdId, barcode, createdAt',
      batches: 'id, householdId, itemId, expiryDate',
      stockTransactions: 'id, householdId, batchId, itemId, &opId, at',
      attachments: 'id, householdId, ownerId',
      contacts: 'id, householdId, kind',
      visits: 'id, householdId, profileId, date',
      documents: 'id, householdId, profileId, date, kind',
      prescriptions: 'id, householdId, profileId, date',
      prescriptionItems: 'id, householdId, prescriptionId, itemId',
      treatments: 'id, householdId, profileId, status',
      treatmentItems: 'id, householdId, treatmentId',
      doseLogs: 'id, householdId, date, &slotKey',
      appointments: 'id, householdId, profileId, date',
      careTasks: 'id, householdId, status, dueDate',
      shoppingItems: 'id, householdId, status',
    });
  }
}

export const db = new HomePharmacyDB();
