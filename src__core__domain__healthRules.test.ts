import { describe, expect, it } from 'vitest';
import {
  EMPTY_APPT,
  EMPTY_CONTACT,
  EMPTY_DOC,
  EMPTY_RX,
  EMPTY_RX_ITEM,
  EMPTY_SHOPPING,
  EMPTY_TASK,
  EMPTY_TREATMENT,
  EMPTY_TX_ITEM,
  EMPTY_VISIT,
  matchesDoc,
  rxAvailability,
  validateAppt,
  validateContact,
  validateDoc,
  validateFile,
  validateRx,
  validateShopping,
  validateTask,
  validateTreatment,
  validateVisit,
  whatsappLink,
} from './healthRules';

const TODAY = '2026-11-11';

describe('validateFile', () => {
  it('يقبل الصور وPDF بالحدود', () => {
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toEqual({ ok: true, value: 'image' });
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toEqual({ ok: true, value: 'pdf' });
  });
  it('يرفض النوع غير المدعوم والحجم الكبير', () => {
    expect(validateFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 }).ok).toBe(false);
    expect(validateFile({ name: 'a.heic', type: 'image/heic', size: 10 }).ok).toBe(false);
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }).ok).toBe(false);
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 26 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe('validateContact', () => {
  it('الاسم مطلوب ويقبل أقل بيانات', () => {
    expect(validateContact({ ...EMPTY_CONTACT, name: '' }).ok).toBe(false);
    expect(validateContact({ ...EMPTY_CONTACT, name: 'د. أحمد' })).toEqual({
      ok: true,
      value: { kind: 'doctor', name: 'د. أحمد', delivery: false },
    });
  });
  it('الهاتف بأرقام عربية، والرابط يجب أن يبدأ بـ http', () => {
    const r = validateContact({ ...EMPTY_CONTACT, name: 'x', phone: '٠١٢٣٤٥٦٧٨٩٠١' });
    expect(r.ok && r.value.phone).toBe('012345678901');
    expect(validateContact({ ...EMPTY_CONTACT, name: 'x', phone: 'abc' }).ok).toBe(false);
    expect(validateContact({ ...EMPTY_CONTACT, name: 'x', mapUrl: 'javascript:alert(1)' }).ok).toBe(false);
    expect(validateContact({ ...EMPTY_CONTACT, name: 'x', mapUrl: 'https://maps.google.com/?q=1' }).ok).toBe(true);
  });
  it('التوصيل للصيدلية فقط', () => {
    const doc = validateContact({ ...EMPTY_CONTACT, name: 'x', delivery: true });
    expect(doc.ok && doc.value.delivery).toBe(false);
    const ph = validateContact({ ...EMPTY_CONTACT, name: 'x', kind: 'pharmacy', delivery: true });
    expect(ph.ok && ph.value.delivery).toBe(true);
  });
  it('نوع غير معروف مرفوض', () => {
    expect(validateContact({ ...EMPTY_CONTACT, name: 'x', kind: 'zzz' }).ok).toBe(false);
  });
});

describe('whatsappLink', () => {
  it('يحوّل الرقم المحلي المصري والدولي', () => {
    expect(whatsappLink('01012345678')).toBe('https://wa.me/201012345678');
    expect(whatsappLink('+20 101 234 5678')).toBe('https://wa.me/201012345678');
    expect(whatsappLink('00201012345678')).toBe('https://wa.me/201012345678');
    expect(whatsappLink('٠١٠١٢٣٤٥٦٧٨')).toBe('https://wa.me/201012345678');
  });
  it('رقم غير صالح = بلا رابط', () => {
    expect(whatsappLink('12')).toBeUndefined();
  });
});

describe('validateVisit', () => {
  const base = { ...EMPTY_VISIT, profileId: 'p1', date: '2026-11-01' };
  it('يقبل زيارة صحيحة', () => {
    expect(validateVisit(base, TODAY)).toEqual({ ok: true, value: { profileId: 'p1', date: '2026-11-01' } });
  });
  it('يرفض الفرد الفارغ وتاريخ المستقبل والتاريخ غير الموجود', () => {
    expect(validateVisit({ ...base, profileId: '' }, TODAY).ok).toBe(false);
    expect(validateVisit({ ...base, date: '2026-12-01' }, TODAY).ok).toBe(false);
    expect(validateVisit({ ...base, date: '2026-02-30' }, TODAY).ok).toBe(false);
  });
});

describe('validateDoc', () => {
  const base = { ...EMPTY_DOC, profileId: 'p1', title: 'صورة دم', date: '2026-10-01' };
  it('يتطلب ملفًا مرفقًا', () => {
    expect(validateDoc(base, TODAY, 0).ok).toBe(false);
    expect(validateDoc(base, TODAY, 1).ok).toBe(true);
  });
  it('يرفض أكثر من 10 ملفات والمستقبل والعنوان الفارغ', () => {
    expect(validateDoc(base, TODAY, 11).ok).toBe(false);
    expect(validateDoc({ ...base, date: '2027-01-01' }, TODAY, 1).ok).toBe(false);
    expect(validateDoc({ ...base, title: ' ' }, TODAY, 1).ok).toBe(false);
  });
});

describe('matchesDoc', () => {
  const d = { title: 'صورة دم كاملة', facility: 'معمل البرج', tags: 'CBC سكر' };
  it('يبحث في العنوان والجهة والكلمات المفتاحية', () => {
    expect(matchesDoc(d, '')).toBe(true);
    expect(matchesDoc(d, 'دم')).toBe(true);
    expect(matchesDoc(d, 'برج')).toBe(true);
    expect(matchesDoc(d, 'cbc')).toBe(true);
    expect(matchesDoc(d, 'أشعة')).toBe(false);
  });
});

describe('validateAppt', () => {
  const base = { ...EMPTY_APPT, profileId: 'p1', title: 'كشف', date: '2026-12-01' };
  it('الوقت اختياري ويُنسَّق', () => {
    expect(validateAppt(base).ok).toBe(true);
    const r = validateAppt({ ...base, time: '٩:٣٠' });
    expect(r.ok && r.value.time).toBe('09:30');
  });
  it('يرفض وقتين ووقتًا خاطئًا', () => {
    expect(validateAppt({ ...base, time: '09:00 10:00' }).ok).toBe(false);
    expect(validateAppt({ ...base, time: '25:00' }).ok).toBe(false);
  });
});

describe('validateTask / validateShopping', () => {
  it('المهمة: العنوان مطلوب والباقي اختياري', () => {
    expect(validateTask({ ...EMPTY_TASK, title: '' }).ok).toBe(false);
    expect(validateTask({ ...EMPTY_TASK, title: 'تحليل' })).toEqual({ ok: true, value: { title: 'تحليل' } });
    expect(validateTask({ ...EMPTY_TASK, title: 'x', dueDate: '2026-13-01' }).ok).toBe(false);
  });
  it('المشتريات: الاسم مطلوب والأولوية صحيحة', () => {
    expect(validateShopping({ ...EMPTY_SHOPPING, name: '' }).ok).toBe(false);
    expect(validateShopping({ ...EMPTY_SHOPPING, name: 'بنادول', priority: 'high' }).ok).toBe(true);
    expect(validateShopping({ ...EMPTY_SHOPPING, name: 'x', priority: 'urgent' }).ok).toBe(false);
  });
});

describe('validateRx', () => {
  const base = { ...EMPTY_RX, profileId: 'p1', date: '2026-11-01' };
  const row = (over = {}) => ({ ...EMPTY_RX_ITEM, writtenName: 'أوجمنتين', ...over });

  it('الصفوف الفارغة تُتجاهل', () => {
    const r = validateRx({ ...base, items: [row(), { ...EMPTY_RX_ITEM }] }, TODAY, 0);
    expect(r.ok && r.value.items).toHaveLength(1);
  });
  it('يتطلب دواءً أو صورة', () => {
    expect(validateRx({ ...base, items: [{ ...EMPTY_RX_ITEM }] }, TODAY, 0).ok).toBe(false);
    expect(validateRx({ ...base, items: [{ ...EMPTY_RX_ITEM }] }, TODAY, 1).ok).toBe(true);
  });
  it('صف فيه تفاصيل بلا اسم دواء مرفوض', () => {
    expect(validateRx({ ...base, items: [row({ writtenName: '', qty: '2' })] }, TODAY, 0).ok).toBe(false);
  });
  it('حالة الصرف تُتحقق، والمستقبل مرفوض', () => {
    expect(validateRx({ ...base, items: [row({ dispenseStatus: 'zzz' })] }, TODAY, 0).ok).toBe(false);
    expect(validateRx({ ...base, date: '2027-01-01', items: [row()] }, TODAY, 0).ok).toBe(false);
  });
});

describe('rxAvailability', () => {
  it('لا تطابق مخترع: غير المربوط يبقى غير مربوط', () => {
    expect(rxAvailability(undefined)).toBe('unlinked');
    expect(rxAvailability(0)).toBe('none');
    expect(rxAvailability(5)).toBe('available');
    expect(rxAvailability(5, 10)).toBe('partial');
    expect(rxAvailability(10, 10)).toBe('available');
  });
});

describe('validateTreatment', () => {
  const base = { ...EMPTY_TREATMENT, profileId: 'p1', name: 'علاج التهاب', startDate: '2026-11-01' };
  const item = (over = {}) => ({ ...EMPTY_TX_ITEM, name: 'أوجمنتين', times: '8:00، 20:00', ...over });

  it('يقبل علاجًا بمواعيد ويرتبها', () => {
    const r = validateTreatment({ ...base, items: [item({ times: '20:00 08:00' })] });
    expect(r.ok && r.value.items[0].times).toEqual(['08:00', '20:00']);
  });
  it('يسمح بدواء بلا مواعيد (بدون تذكير)', () => {
    const r = validateTreatment({ ...base, items: [item({ times: '' })] });
    expect(r.ok && r.value.items[0].times).toEqual([]);
  });
  it('يرفض نهاية قبل البداية وعلاجًا بلا أدوية ووقتًا خاطئًا', () => {
    expect(validateTreatment({ ...base, endDate: '2026-10-01', items: [item()] }).ok).toBe(false);
    expect(validateTreatment({ ...base, items: [{ ...EMPTY_TX_ITEM }] }).ok).toBe(false);
    expect(validateTreatment({ ...base, items: [item({ times: '99:00' })] }).ok).toBe(false);
  });
});
