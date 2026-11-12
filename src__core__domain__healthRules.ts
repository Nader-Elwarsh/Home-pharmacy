import { normalizeDigits } from './numbers';
import { collect, optDate, optId, optText, pickEnum, reqDate, reqId, reqText } from './fields';
import type { Validation } from './householdRules';
import { parseTimes } from './schedule';

// ===== الملفات المرفقة =====
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // قبل الضغط
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_RECORD = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateFile(file: { name: string; type: string; size: number }): Validation<'image' | 'pdf'> {
  if (file.type === 'application/pdf') {
    return file.size > MAX_PDF_BYTES
      ? { ok: false, error: `الملف "${file.name}" أكبر من 10 ميجابايت` }
      : { ok: true, value: 'pdf' };
  }
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return file.size > MAX_IMAGE_BYTES
      ? { ok: false, error: `الصورة "${file.name}" كبيرة جدًا` }
      : { ok: true, value: 'image' };
  }
  return { ok: false, error: `نوع الملف "${file.name}" غير مدعوم. المسموح: صور JPG وPNG وWebP وملفات PDF` };
}

// ===== الدليل الشخصي =====
export const CONTACT_KINDS = ['doctor', 'clinic', 'pharmacy', 'lab'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];
export const CONTACT_LABELS: Record<ContactKind, string> = {
  doctor: 'طبيب',
  clinic: 'عيادة',
  pharmacy: 'صيدلية',
  lab: 'معمل أو مركز أشعة',
};

export interface ContactInput {
  kind: string;
  name: string;
  specialty: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  fee: string;
  mapUrl: string;
  delivery: boolean;
  notes: string;
}
export const EMPTY_CONTACT: ContactInput = {
  kind: 'doctor',
  name: '',
  specialty: '',
  phone: '',
  whatsapp: '',
  address: '',
  hours: '',
  fee: '',
  mapUrl: '',
  delivery: false,
  notes: '',
};
export interface ContactData {
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
}

function optPhone(raw: string, label: string): Validation<string | undefined> {
  const value = normalizeDigits(raw).replace(/\s+/g, ' ').trim();
  if (value === '') return { ok: true, value: undefined };
  if (!/^\+?[\d][\d\s-]{5,19}$/.test(value)) return { ok: false, error: `${label} غير صحيح` };
  return { ok: true, value };
}

function optUrl(raw: string, label: string): Validation<string | undefined> {
  const value = raw.trim();
  if (value === '') return { ok: true, value: undefined };
  if (value.length > 500 || !/^https?:\/\/\S+$/i.test(value)) {
    return { ok: false, error: `${label} يجب أن يبدأ بـ http أو https` };
  }
  return { ok: true, value };
}

export function validateContact(i: ContactInput): Validation<ContactData> {
  const r = collect({
    kind: pickEnum(i.kind, CONTACT_KINDS, 'النوع'),
    name: reqText(i.name, 'الاسم', 120),
    specialty: optText(i.specialty, 'التخصص', 80),
    phone: optPhone(i.phone, 'رقم الهاتف'),
    whatsapp: optPhone(i.whatsapp, 'رقم واتساب'),
    address: optText(i.address, 'العنوان', 200),
    hours: optText(i.hours, 'مواعيد العمل', 120),
    fee: optText(i.fee, 'سعر الكشف', 40),
    mapUrl: optUrl(i.mapUrl, 'رابط الموقع'),
    notes: optText(i.notes, 'الملاحظات', 500),
  });
  if (!r.ok) return r;
  return { ok: true, value: { ...r.value, delivery: i.kind === 'pharmacy' && i.delivery } };
}

/** رابط واتساب من رقم محلي مصري (يبدأ بـ 0) أو دولي. */
export function whatsappLink(raw: string): string | undefined {
  let digits = normalizeDigits(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? `https://wa.me/${digits}` : undefined;
}

// ===== الزيارات =====
export interface VisitInput {
  profileId: string;
  date: string;
  contactId: string;
  reason: string;
  notes: string;
}
export const EMPTY_VISIT: VisitInput = { profileId: '', date: '', contactId: '', reason: '', notes: '' };
export interface VisitData {
  profileId: string;
  date: string;
  contactId?: string;
  reason?: string;
  notes?: string;
}
export function validateVisit(i: VisitInput, today: string): Validation<VisitData> {
  const r = collect({
    profileId: reqId(i.profileId, 'الفرد'),
    date: reqDate(i.date, 'تاريخ الزيارة'),
    contactId: optId(i.contactId),
    reason: optText(i.reason, 'سبب الزيارة', 200),
    notes: optText(i.notes, 'الملاحظات', 1000),
  });
  if (!r.ok) return r;
  if (r.value.date > today) return { ok: false, error: 'تاريخ الزيارة في المستقبل. سجّله كموعد قادم' };
  return r;
}

// ===== المستندات الطبية =====
export const DOC_KINDS = ['lab', 'radiology', 'sonar', 'report', 'vaccine', 'other'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABELS: Record<DocKind, string> = {
  lab: 'تحليل',
  radiology: 'أشعة',
  sonar: 'سونار',
  report: 'تقرير طبي',
  vaccine: 'شهادة تطعيم',
  other: 'مستند آخر',
};

export interface DocInput {
  profileId: string;
  kind: string;
  title: string;
  date: string;
  facility: string;
  contactId: string;
  visitId: string;
  notes: string;
  tags: string;
}
export const EMPTY_DOC: DocInput = {
  profileId: '',
  kind: 'lab',
  title: '',
  date: '',
  facility: '',
  contactId: '',
  visitId: '',
  notes: '',
  tags: '',
};
export interface DocData {
  profileId: string;
  kind: DocKind;
  title: string;
  date: string;
  facility?: string;
  contactId?: string;
  visitId?: string;
  notes?: string;
  tags?: string;
}
export function validateDoc(i: DocInput, today: string, fileCount: number): Validation<DocData> {
  const r = collect({
    profileId: reqId(i.profileId, 'الفرد'),
    kind: pickEnum(i.kind, DOC_KINDS, 'النوع'),
    title: reqText(i.title, 'اسم المستند', 120),
    date: reqDate(i.date, 'تاريخ المستند'),
    facility: optText(i.facility, 'المعمل أو المستشفى', 120),
    contactId: optId(i.contactId),
    visitId: optId(i.visitId),
    notes: optText(i.notes, 'الملاحظات', 1000),
    tags: optText(i.tags, 'الكلمات المفتاحية', 200),
  });
  if (!r.ok) return r;
  if (r.value.date > today) return { ok: false, error: 'تاريخ المستند في المستقبل' };
  if (fileCount === 0) return { ok: false, error: 'أرفق صورة أو ملف PDF للمستند' };
  if (fileCount > MAX_FILES_PER_RECORD) return { ok: false, error: `الحد الأقصى ${MAX_FILES_PER_RECORD} ملفات` };
  return r;
}

/** بحث في المستندات: العنوان أو الجهة أو الملاحظات أو الكلمات المفتاحية. */
export function matchesDoc(
  d: { title: string; facility?: string; notes?: string; tags?: string },
  rawQuery: string,
): boolean {
  const q = normalizeDigits(rawQuery).trim().toLowerCase();
  if (q === '') return true;
  return [d.title, d.facility, d.notes, d.tags]
    .filter((v): v is string => typeof v === 'string')
    .some((v) => normalizeDigits(v).toLowerCase().includes(q));
}

// ===== المواعيد =====
export const APPT_KINDS = ['doctor', 'lab', 'radiology', 'vaccine', 'followup', 'other'] as const;
export type ApptKind = (typeof APPT_KINDS)[number];
export const APPT_LABELS: Record<ApptKind, string> = {
  doctor: 'طبيب',
  lab: 'تحليل',
  radiology: 'أشعة',
  vaccine: 'تطعيم',
  followup: 'متابعة',
  other: 'آخر',
};
export interface ApptInput {
  profileId: string;
  kind: string;
  title: string;
  date: string;
  time: string;
  contactId: string;
  notes: string;
}
export const EMPTY_APPT: ApptInput = { profileId: '', kind: 'doctor', title: '', date: '', time: '', contactId: '', notes: '' };
export interface ApptData {
  profileId: string;
  kind: ApptKind;
  title: string;
  date: string;
  time?: string;
  contactId?: string;
  notes?: string;
}
export function validateAppt(i: ApptInput): Validation<ApptData> {
  const timeRaw = i.time.trim();
  let time: string | undefined;
  if (timeRaw !== '') {
    const t = parseTimes(timeRaw);
    if (!t.ok) return t;
    if (t.value.length !== 1) return { ok: false, error: 'اكتب وقتًا واحدًا للموعد' };
    time = t.value[0];
  }
  const r = collect({
    profileId: reqId(i.profileId, 'الفرد'),
    kind: pickEnum(i.kind, APPT_KINDS, 'النوع'),
    title: reqText(i.title, 'عنوان الموعد', 120),
    date: reqDate(i.date, 'تاريخ الموعد'),
    contactId: optId(i.contactId),
    notes: optText(i.notes, 'الملاحظات', 500),
  });
  if (!r.ok) return r;
  return { ok: true, value: time ? { ...r.value, time } : r.value };
}

// ===== المهام =====
export interface TaskInput {
  title: string;
  profileId: string;
  dueDate: string;
}
export const EMPTY_TASK: TaskInput = { title: '', profileId: '', dueDate: '' };
export interface TaskData {
  title: string;
  profileId?: string;
  dueDate?: string;
}
export function validateTask(i: TaskInput): Validation<TaskData> {
  return collect({
    title: reqText(i.title, 'عنوان المهمة', 160),
    profileId: optId(i.profileId),
    dueDate: optDate(i.dueDate, 'تاريخ الاستحقاق'),
  });
}

// ===== قائمة المشتريات =====
export const PRIORITIES = ['normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { normal: 'عادية', high: 'عاجلة' };
export interface ShoppingInput {
  name: string;
  qty: string;
  profileId: string;
  priority: string;
  reason: string;
}
export const EMPTY_SHOPPING: ShoppingInput = { name: '', qty: '', profileId: '', priority: 'normal', reason: '' };
export interface ShoppingData {
  name: string;
  qty?: string;
  profileId?: string;
  priority: Priority;
  reason?: string;
}
export function validateShopping(i: ShoppingInput): Validation<ShoppingData> {
  return collect({
    name: reqText(i.name, 'اسم الصنف', 120),
    qty: optText(i.qty, 'الكمية', 40),
    profileId: optId(i.profileId),
    priority: pickEnum(i.priority, PRIORITIES, 'الأولوية'),
    reason: optText(i.reason, 'السبب', 200),
  });
}

// ===== الروشتات =====
export const DISPENSE_STATUSES = ['pending', 'dispensed', 'partial', 'unavailable'] as const;
export type DispenseStatus = (typeof DISPENSE_STATUSES)[number];
export const DISPENSE_LABELS: Record<DispenseStatus, string> = {
  pending: 'لم يُصرف',
  dispensed: 'تم صرفه',
  partial: 'صُرف جزئيًا',
  unavailable: 'غير متوفر',
};

export interface RxItemInput {
  writtenName: string;
  itemId: string;
  strength: string;
  qty: string;
  instructions: string;
  duration: string;
  dispenseStatus: string;
}
export const EMPTY_RX_ITEM: RxItemInput = {
  writtenName: '',
  itemId: '',
  strength: '',
  qty: '',
  instructions: '',
  duration: '',
  dispenseStatus: 'pending',
};
export interface RxItemData {
  writtenName: string;
  itemId?: string;
  strength?: string;
  qty?: string;
  instructions?: string;
  duration?: string;
  dispenseStatus: DispenseStatus;
}
export interface RxInput {
  profileId: string;
  date: string;
  contactId: string;
  visitId: string;
  reason: string;
  notes: string;
  items: RxItemInput[];
}
export const EMPTY_RX: RxInput = { profileId: '', date: '', contactId: '', visitId: '', reason: '', notes: '', items: [{ ...EMPTY_RX_ITEM }] };
export interface RxData {
  profileId: string;
  date: string;
  contactId?: string;
  visitId?: string;
  reason?: string;
  notes?: string;
  items: RxItemData[];
}

function rxItemIsBlank(i: RxItemInput): boolean {
  return [i.writtenName, i.strength, i.qty, i.instructions, i.duration].every((v) => v.trim() === '') && i.itemId.trim() === '';
}

export function validateRx(i: RxInput, today: string, fileCount: number): Validation<RxData> {
  const head = collect({
    profileId: reqId(i.profileId, 'الفرد'),
    date: reqDate(i.date, 'تاريخ الزيارة'),
    contactId: optId(i.contactId),
    visitId: optId(i.visitId),
    reason: optText(i.reason, 'السبب', 200),
    notes: optText(i.notes, 'الملاحظات', 1000),
  });
  if (!head.ok) return head;
  if (head.value.date > today) return { ok: false, error: 'تاريخ الروشتة في المستقبل' };

  const items: RxItemData[] = [];
  for (const row of i.items.filter((x) => !rxItemIsBlank(x))) {
    const r = collect({
      writtenName: reqText(row.writtenName, 'اسم الدواء المكتوب', 120),
      itemId: optId(row.itemId),
      strength: optText(row.strength, 'التركيز', 40),
      qty: optText(row.qty, 'الكمية', 40),
      instructions: optText(row.instructions, 'تعليمات الاستخدام', 300),
      duration: optText(row.duration, 'المدة', 60),
      dispenseStatus: pickEnum(row.dispenseStatus, DISPENSE_STATUSES, 'حالة الصرف'),
    });
    if (!r.ok) return r;
    items.push(r.value);
  }
  if (items.length === 0 && fileCount === 0) {
    return { ok: false, error: 'أضف دواءً واحدًا على الأقل أو أرفق صورة الروشتة' };
  }
  if (fileCount > MAX_FILES_PER_RECORD) return { ok: false, error: `الحد الأقصى ${MAX_FILES_PER_RECORD} ملفات` };
  return { ok: true, value: { ...head.value, items } };
}

export type Availability = 'unlinked' | 'available' | 'partial' | 'none';
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  unlinked: 'غير مربوط بدواء في الخزانة',
  available: 'موجود في الخزانة',
  partial: 'موجود جزئيًا',
  none: 'غير موجود (نفدت الكمية)',
};

/**
 * حالة توفر دواء الروشتة في الخزانة. لا تعني أن الموجود يطابق الوصفة:
 * الربط يختاره المستخدم، والتحقق من التركيز والشكل مسؤولية الطبيب أو الصيدلي.
 */
export function rxAvailability(linkedItemQty: number | undefined, neededQty?: number): Availability {
  if (linkedItemQty === undefined) return 'unlinked';
  if (linkedItemQty <= 0) return 'none';
  if (neededQty !== undefined && linkedItemQty < neededQty) return 'partial';
  return 'available';
}

// ===== العلاجات =====
export const TREATMENT_STATUSES = ['active', 'completed', 'stopped'] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];
export const TREATMENT_LABELS: Record<TreatmentStatus, string> = {
  active: 'جارٍ',
  completed: 'مكتمل',
  stopped: 'موقوف',
};

export interface TxItemInput {
  name: string;
  itemId: string;
  instructions: string;
  times: string;
}
export const EMPTY_TX_ITEM: TxItemInput = { name: '', itemId: '', instructions: '', times: '' };
export interface TxItemData {
  name: string;
  itemId?: string;
  instructions?: string;
  times: string[];
}
export interface TreatmentInput {
  profileId: string;
  name: string;
  startDate: string;
  endDate: string;
  contactId: string;
  prescriptionId: string;
  notes: string;
  items: TxItemInput[];
}
export const EMPTY_TREATMENT: TreatmentInput = {
  profileId: '',
  name: '',
  startDate: '',
  endDate: '',
  contactId: '',
  prescriptionId: '',
  notes: '',
  items: [{ ...EMPTY_TX_ITEM }],
};
export interface TreatmentData {
  profileId: string;
  name: string;
  startDate: string;
  endDate?: string;
  contactId?: string;
  prescriptionId?: string;
  notes?: string;
  items: TxItemData[];
}
export function validateTreatment(i: TreatmentInput): Validation<TreatmentData> {
  const head = collect({
    profileId: reqId(i.profileId, 'الفرد'),
    name: reqText(i.name, 'اسم العلاج', 120),
    startDate: reqDate(i.startDate, 'تاريخ البداية'),
    endDate: optDate(i.endDate, 'تاريخ النهاية'),
    contactId: optId(i.contactId),
    prescriptionId: optId(i.prescriptionId),
    notes: optText(i.notes, 'الملاحظات', 1000),
  });
  if (!head.ok) return head;
  if (head.value.endDate && head.value.endDate < head.value.startDate) {
    return { ok: false, error: 'تاريخ النهاية قبل تاريخ البداية' };
  }

  const items: TxItemData[] = [];
  for (const row of i.items.filter((x) => [x.name, x.instructions, x.times].some((v) => v.trim() !== '') || x.itemId.trim() !== '')) {
    const r = collect({
      name: reqText(row.name, 'اسم الدواء في العلاج', 120),
      itemId: optId(row.itemId),
      instructions: optText(row.instructions, 'تعليمات الاستخدام', 300),
      times: parseTimes(row.times),
    });
    if (!r.ok) return r;
    items.push({ ...r.value, times: r.value.times ?? [] });
  }
  if (items.length === 0) return { ok: false, error: 'أضف دواءً واحدًا على الأقل في العلاج' };
  return { ok: true, value: { ...head.value, items } };
}
