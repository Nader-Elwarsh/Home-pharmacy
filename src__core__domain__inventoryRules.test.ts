import { describe, expect, it } from 'vitest';
import {
  EMPTY_BATCH_INPUT,
  EMPTY_ITEM_INPUT,
  matchesQuery,
  validateBarcode,
  validateBatch,
  validateItem,
  type BatchInput,
  type ItemInput,
} from './inventoryRules';

const TODAY = '2026-11-11';
const item = (over: Partial<ItemInput> = {}): ItemInput => ({
  ...EMPTY_ITEM_INPUT,
  tradeName: 'باراسيتامول',
  ...over,
});
const batch = (over: Partial<BatchInput> = {}): BatchInput => ({
  ...EMPTY_BATCH_INPUT,
  expiry: '06/2027',
  packs: '1',
  ...over,
});

describe('validateItem', () => {
  it('يقبل صنفًا بأقل البيانات', () => {
    const r = validateItem(item());
    expect(r).toEqual({
      ok: true,
      value: { tradeName: 'باراسيتامول', baseUnit: 'قرص', unitsPerPack: 1 },
    });
  });
  it('يحفظ الحقول الاختيارية المُدخلة فقط', () => {
    const r = validateItem(item({ strength: ' 500mg ', unitsPerPack: '٢٠', barcode: '622 1234 5678' }));
    expect(r.ok && r.value).toMatchObject({ strength: '500mg', unitsPerPack: 20, barcode: '62212345678' });
    expect(r.ok && 'scientificName' in r.value).toBe(false);
  });
  it('يرفض الاسم الفارغ والوحدة الفارغة وعدد وحدات أقل من 1', () => {
    expect(validateItem(item({ tradeName: ' ' })).ok).toBe(false);
    expect(validateItem(item({ baseUnit: '' })).ok).toBe(false);
    expect(validateItem(item({ unitsPerPack: '0' })).ok).toBe(false);
    expect(validateItem(item({ unitsPerPack: 'x' })).ok).toBe(false);
  });
});

describe('validateBarcode', () => {
  it('أرقام فقط من 6 إلى 14', () => {
    expect(validateBarcode('').ok).toBe(true);
    expect(validateBarcode('12345').ok).toBe(false);
    expect(validateBarcode('123456789012345').ok).toBe(false);
    expect(validateBarcode('12ab56').ok).toBe(false);
    expect(validateBarcode('٦٢٢١٢٣٤٥٦').ok).toBe(true);
  });
});

describe('validateBatch', () => {
  it('عبوة واحدة بوحدة أساسية 1', () => {
    const r = validateBatch(batch({ packs: '3' }), 1, TODAY);
    expect(r.ok && r.value.qtyBaseUnits).toBe(3);
  });
  it('عبوات ووحدات سائبة: 2 علبة (10 أقراص) + 5 أقراص = 25', () => {
    const r = validateBatch(batch({ packs: '2', units: '5' }), 10, TODAY);
    expect(r.ok && r.value.qtyBaseUnits).toBe(25);
  });
  it('الوحدات السائبة فقط', () => {
    const r = validateBatch(batch({ packs: '', units: '7' }), 10, TODAY);
    expect(r.ok && r.value.qtyBaseUnits).toBe(7);
  });
  it('يتجاهل حقل الوحدات عندما تكون وحدة العبوة 1', () => {
    const r = validateBatch(batch({ packs: '2', units: '9' }), 1, TODAY);
    expect(r.ok && r.value.qtyBaseUnits).toBe(2);
  });
  it('يرفض الكمية صفر', () => {
    expect(validateBatch(batch({ packs: '', units: '' }), 10, TODAY).ok).toBe(false);
    expect(validateBatch(batch({ packs: '0' }), 10, TODAY).ok).toBe(false);
  });
  it('يتطلب صلاحية صحيحة', () => {
    expect(validateBatch(batch({ expiry: '' }), 1, TODAY).ok).toBe(false);
    expect(validateBatch(batch({ expiry: '99/2027' }), 1, TODAY).ok).toBe(false);
  });
  it('يقبل صلاحية منتهية (تُعرض بحالة منتهية)', () => {
    expect(validateBatch(batch({ expiry: '01/2020' }), 1, TODAY).ok).toBe(true);
  });
  it('يرفض تاريخ شراء في المستقبل', () => {
    expect(validateBatch(batch({ purchaseDate: '2026-12-01' }), 1, TODAY).ok).toBe(false);
  });
  it('يحفظ الدقة والحقول الاختيارية', () => {
    const r = validateBatch(batch({ batchNo: ' A1 ', location: 'الثلاجة', purchaseDate: '2026-11-01' }), 1, TODAY);
    expect(r.ok && r.value).toMatchObject({
      batchNo: 'A1',
      location: 'الثلاجة',
      purchaseDate: '2026-11-01',
      expiryDate: '2027-06-30',
      expiryPrecision: 'month',
      packState: 'sealed',
    });
  });
});

describe('matchesQuery', () => {
  const it1 = { tradeName: 'بنادول', scientificName: 'Paracetamol', barcode: '6221234567890' };
  it('بحث فارغ يطابق الكل', () => {
    expect(matchesQuery(it1, '  ')).toBe(true);
  });
  it('يطابق الاسم والعلمي (دون حساسية حالة) والباركود', () => {
    expect(matchesQuery(it1, 'بنا')).toBe(true);
    expect(matchesQuery(it1, 'PARACET')).toBe(true);
    expect(matchesQuery(it1, '٦٢٢١٢٣')).toBe(true);
    expect(matchesQuery(it1, 'اسبرين')).toBe(false);
  });
});
