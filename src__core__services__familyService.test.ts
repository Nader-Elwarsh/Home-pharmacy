import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { UserInputError } from '../domain/errors';
import { addLocalProfile, createLocalHousehold, loadLocalFamily } from './familyService';

beforeEach(async () => {
  await db.open();
  await db.profiles.clear();
  await db.households.clear();
});

describe('الأسرة المحلية', () => {
  it('لا يوجد منزل في البداية', async () => {
    expect(await loadLocalFamily()).toBeNull();
  });

  it('ينشئ منزلًا ويقص الاسم', async () => {
    await createLocalHousehold('  بيت العائلة ');
    const family = await loadLocalFamily();
    expect(family?.household.name).toBe('بيت العائلة');
    expect(family?.profiles).toEqual([]);
  });

  it('يرفض اسم منزل فارغ', async () => {
    await expect(createLocalHousehold('   ')).rejects.toBeInstanceOf(UserInputError);
    expect(await loadLocalFamily()).toBeNull();
  });

  it('لا يسمح بمنزل ثانٍ', async () => {
    await createLocalHousehold('الأول');
    await expect(createLocalHousehold('الثاني')).rejects.toBeInstanceOf(UserInputError);
    expect(await db.households.count()).toBe(1);
  });

  it('يضيف أفرادًا ويعيدهم بترتيب الإضافة', async () => {
    await createLocalHousehold('بيتنا');
    await addLocalProfile('أحمد', '1990-05-20');
    await addLocalProfile('سارة', '');
    const family = await loadLocalFamily();
    expect(family?.profiles.map((p) => p.name)).toEqual(['أحمد', 'سارة']);
    expect(family?.profiles[0].birthDate).toBe('1990-05-20');
    expect(family?.profiles[1].birthDate).toBeUndefined();
  });

  it('يرفض إضافة فرد قبل إنشاء المنزل', async () => {
    await expect(addLocalProfile('أحمد', '')).rejects.toBeInstanceOf(UserInputError);
  });

  it('يرفض تاريخ ميلاد غير صحيح دون حفظ شيء', async () => {
    await createLocalHousehold('بيتنا');
    await expect(addLocalProfile('أحمد', '2023-02-30')).rejects.toBeInstanceOf(UserInputError);
    expect((await loadLocalFamily())?.profiles).toEqual([]);
  });

  it('كل سجل يحمل معرّفه ومعرّف المنزل ونسخة المخطط', async () => {
    await createLocalHousehold('بيتنا');
    await addLocalProfile('أحمد', '');
    const household = (await db.households.toArray())[0];
    const profile = (await db.profiles.toArray())[0];
    expect(profile.householdId).toBe(household.id);
    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(profile.schemaVersion).toBe(1);
    expect(profile.deletedAt).toBeUndefined();
  });

  it('الفرد المؤرشف لا يظهر', async () => {
    await createLocalHousehold('بيتنا');
    await addLocalProfile('أحمد', '');
    const p = (await db.profiles.toArray())[0];
    await db.profiles.update(p.id, { deletedAt: new Date().toISOString() });
    expect((await loadLocalFamily())?.profiles).toEqual([]);
  });
});
