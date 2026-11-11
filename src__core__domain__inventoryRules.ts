import { parseExpiry, parsePastOrTodayDate, type ExpiryPrecision } from './dates';
import type { Validation } from './householdRules';
import type { PackState } from './inventoryTypes';
import { normalizeDigits, parseCount } from './numbers';

export interface ItemInput {
  tradeName: string;
  scientificName: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  baseUnit: string;
  unitsPerPack: string;
  barcode: string;
  notes: string;
}

export const EMPTY_ITEM_INPUT: ItemInput = {
  tradeName: '',
  scientificName: '',
  activeIngredient: '',
  strength: '',
  dosageForm: '',
  baseUnit: 'قرص',
  unitsPerPack: '1',
  barcode: '',
  notes: '',
};

export interface ItemData {
  tradeName: string;
  scientificName?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  baseUnit: string;
  unitsPerPack: number;
  barcode?: string;
  notes?: string;
}

export interface BatchInput {
  batchNo: string;
  expiry: string;
  purchaseDate: string;
  packs: string;
  units: string;
  location: string;
  packState: PackState;
}

export const EMPTY_BATCH_INPUT: BatchInput = {
  batchNo: '',
  expiry: '',
  purchaseDate: '',
  packs: '',
  units: '',
  location: '',
  packState: 'sealed',
};

export interface BatchData {
  batchNo?: string;
  expiryDate: string;
  expiryPrecision: ExpiryPrecision;
  purchaseDate?: string;
  location?: string;
  packState: PackState;
  /** الكمية الابتدائية بالوحدة الأساسية */
  qtyBaseUnits: number;
}

export const MAX_UNITS_PER_PACK = 10_000;
export const MAX_QTY = 10_000_000;

function optionalText(raw: string, max: number, label: string): Validation<string | undefined> {
  const value = raw.trim();
  if (value === '') return { ok: true, value: undefined };
  if (value.length > max) return { ok: false, error: `${label} طويل جدًا (الحد ${max} حرفًا)` };
  return { ok: true, value };
}

/** لعرض حقول الكمية المناسبة أثناء الكتابة؛ القيمة غير الصالحة تُعامل كـ 1. */
export function previewUnitsPerPack(raw: string): number {
  const r = parseCount(raw, '', MAX_UNITS_PER_PACK);
  return r.ok && r.value >= 1 ? r.value : 1;
}

export function validateBarcode(raw: string): Validation<string | undefined> {
  const value = normalizeDigits(raw).replace(/\s+/g, '');
  if (value === '') return { ok: true, value: undefined };
  if (!/^\d{6,14}$/.test(value)) {
    return { ok: false, error: 'الباركود يجب أن يكون أرقامًا فقط (من 6 إلى 14 رقمًا)' };
  }
  return { ok: true, value };
}

export function validateItem(input: ItemInput): Validation<ItemData> {
  const tradeName = input.tradeName.trim();
  if (tradeName === '') return { ok: false, error: 'اسم الدواء مطلوب' };
  if (tradeName.length > 120) return { ok: false, error: 'اسم الدواء طويل جدًا' };

  const baseUnit = input.baseUnit.trim();
  if (baseUnit === '') return { ok: false, error: 'وحدة القياس مطلوبة (مثل: قرص، مل)' };
  if (baseUnit.length > 20) return { ok: false, error: 'اسم الوحدة طويل جدًا' };

  const upp = parseCount(input.unitsPerPack, 'عدد الوحدات في العبوة', MAX_UNITS_PER_PACK);
  if (!upp.ok) return upp;
  if (upp.value < 1) return { ok: false, error: 'عدد الوحدات في العبوة لا يقل عن 1' };

  const scientificName = optionalText(input.scientificName, 120, 'الاسم العلمي');
  if (!scientificName.ok) return scientificName;
  const activeIngredient = optionalText(input.activeIngredient, 120, 'المادة الفعالة');
  if (!activeIngredient.ok) return activeIngredient;
  const strength = optionalText(input.strength, 40, 'التركيز');
  if (!strength.ok) return strength;
  const dosageForm = optionalText(input.dosageForm, 40, 'الشكل الدوائي');
  if (!dosageForm.ok) return dosageForm;
  const notes = optionalText(input.notes, 500, 'الملاحظات');
  if (!notes.ok) return notes;
  const barcode = validateBarcode(input.barcode);
  if (!barcode.ok) return barcode;

  const data: ItemData = { tradeName, baseUnit, unitsPerPack: upp.value };
  if (scientificName.value) data.scientificName = scientificName.value;
  if (activeIngredient.value) data.activeIngredient = activeIngredient.value;
  if (strength.value) data.strength = strength.value;
  if (dosageForm.value) data.dosageForm = dosageForm.value;
  if (barcode.value) data.barcode = barcode.value;
  if (notes.value) data.notes = notes.value;
  return { ok: true, value: data };
}

export function validateBatch(
  input: BatchInput,
  unitsPerPack: number,
  today: string,
): Validation<BatchData> {
  const expiry = parseExpiry(input.expiry);
  if (!expiry.ok) return expiry;

  const purchase = parsePastOrTodayDate(input.purchaseDate, today);
  if (!purchase.ok) return purchase;

  const packs = parseCount(input.packs, unitsPerPack === 1 ? 'العدد' : 'عدد العبوات', MAX_QTY);
  if (!packs.ok) return packs;
  const units = unitsPerPack === 1 ? { ok: true as const, value: 0 } : parseCount(input.units, 'عدد الوحدات', MAX_QTY);
  if (!units.ok) return units;

  const total = packs.value * unitsPerPack + units.value;
  if (total <= 0) return { ok: false, error: 'أدخل كمية أكبر من صفر' };
  if (total > MAX_QTY) return { ok: false, error: 'الكمية كبيرة جدًا' };

  const batchNo = optionalText(input.batchNo, 60, 'رقم التشغيلة');
  if (!batchNo.ok) return batchNo;
  const location = optionalText(input.location, 60, 'مكان التخزين');
  if (!location.ok) return location;

  const data: BatchData = {
    expiryDate: expiry.value.date,
    expiryPrecision: expiry.value.precision,
    packState: input.packState,
    qtyBaseUnits: total,
  };
  if (batchNo.value) data.batchNo = batchNo.value;
  if (purchase.value) data.purchaseDate = purchase.value;
  if (location.value) data.location = location.value;
  return { ok: true, value: data };
}

export interface SearchableItem {
  tradeName: string;
  scientificName?: string;
  activeIngredient?: string;
  barcode?: string;
}

/** بحث بسيط: يطابق الاسم التجاري أو العلمي أو المادة الفعالة أو الباركود. */
export function matchesQuery(item: SearchableItem, rawQuery: string): boolean {
  const q = normalizeDigits(rawQuery).trim().toLowerCase();
  if (q === '') return true;
  return [item.tradeName, item.scientificName, item.activeIngredient, item.barcode]
    .filter((v): v is string => typeof v === 'string')
    .some((v) => v.toLowerCase().includes(q));
}
