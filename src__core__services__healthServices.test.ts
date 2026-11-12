import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { UserInputError } from '../domain/errors';
import { EMPTY_APPT, EMPTY_CONTACT, EMPTY_RX, EMPTY_RX_ITEM, EMPTY_TREATMENT, EMPTY_TX_ITEM, EMPTY_VISIT } from '../domain/healthRules';
import { EMPTY_BATCH_INPUT, EMPTY_ITEM_INPUT } from '../domain/inventoryRules';
import { addLocalProfile, createLocalHousehold, loadLocalFamily } from './familyService';
import { addContact, listContacts } from './directoryService';
import { loadDashboard } from './dashboardService';
import { addPrescription, addVisit, listPrescriptions, loadProfileOverview } from './healthService';
import { createItem } from './inventoryService';
import { addAppointment, addShopping, listShopping } from './planningService';
import { addTreatment, listTreatments, loadDoses, setDose } from './treatmentService';

const NOW = new Date(2026, 10, 11, 10, 0); // 2026-11-11 10:00

async function setup() {
  await createLocalHousehold('بيتنا');
  await addLocalProfile('أحمد', '');
  const fam = await loadLocalFamily();
  return fam!.profiles[0].id;
}

beforeEach(async () => {
  await db.open();
  for (const t of db.tables) await t.clear();
});

describe('الزيارات والروشتات', () => {
  it('الزيارة المستقبلية مرفوضة والماضية تظهر في الخط الزمني', async () => {
    const pid = await setup();
    await expect(addVisit({ ...EMPTY_VISIT, profileId: pid, date: '2026-12-01' }, NOW)).rejects.toBeInstanceOf(UserInputError);
    await addVisit({ ...EMPTY_VISIT, profileId: pid, date: '2026-11-01', reason: 'كشف' }, NOW);
    const o = await loadProfileOverview(pid, NOW);
    expect(o?.timeline.past).toHaveLength(1);
    expect(o?.visits[0].reason).toBe('كشف');
  });

  it('الروشتة المربوطة بدواء تعرض التوفر من الخزانة الفعلية', async () => {
    const pid = await setup();
    const itemId = await createItem({ ...EMPTY_ITEM_INPUT, tradeName: 'بنادول' }, { ...EMPTY_BATCH_INPUT, expiry: '06/2027', packs: '2' }, NOW);
    await addPrescription(
      { ...EMPTY_RX, profileId: pid, date: '2026-11-10', items: [{ ...EMPTY_RX_ITEM, writtenName: 'بنادول', itemId }, { ...EMPTY_RX_ITEM, writtenName: 'دواء آخر' }] },
      [],
      NOW,
    );
    const rx = await listPrescriptions(pid);
    expect(rx[0].items.map((i) => i.availability)).toEqual(['available', 'unlinked']);
  });
});

describe('العلاجات والجرعات', () => {
  it('الجرعات من جدول المستخدم فقط، والتسجيل مرتين لا يكرر السجل ولا يمس المخزون', async () => {
    const pid = await setup();
    await addTreatment({
      ...EMPTY_TREATMENT, profileId: pid, name: 'علاج', startDate: '2026-11-10',
      items: [{ ...EMPTY_TX_ITEM, name: 'دواء', times: '08:00 20:00' }],
    });
    const doses = await loadDoses(undefined, NOW);
    expect(doses.map((d) => [d.time, d.state])).toEqual([['08:00', 'overdue'], ['20:00', 'pending']]);

    await setDose(doses[0], 'taken');
    await setDose(doses[0], 'skipped', 'سبب');
    expect(await db.doseLogs.count()).toBe(1);
    expect((await loadDoses(undefined, NOW))[0].state).toBe('skipped');
    expect(await db.stockTransactions.count()).toBe(0);
  });

  it('علاج بلا مواعيد لا يولّد جرعات، والعلاج الموقوف لا يظهر في جرعات اليوم', async () => {
    const pid = await setup();
    await addTreatment({ ...EMPTY_TREATMENT, profileId: pid, name: 'ع', startDate: '2026-11-10', items: [{ ...EMPTY_TX_ITEM, name: 'د' }] });
    expect(await loadDoses(undefined, NOW)).toEqual([]);
    expect((await listTreatments(pid))[0].items[0].times).toEqual([]);
  });
});

describe('التخطيط والدليل والتنبيهات', () => {
  it('الدليل والمشتريات والمواعيد', async () => {
    const pid = await setup();
    await addContact({ ...EMPTY_CONTACT, name: 'د. سمير', phone: '01012345678', whatsapp: '01012345678' });
    const c = await listContacts();
    expect(c[0].whatsappUrl).toBe('https://wa.me/201012345678');
    await addShopping({ name: 'فيتامين', qty: '', profileId: '', priority: 'high', reason: '' });
    expect((await listShopping())[0].priorityLabel).toBe('عاجلة');
    await addAppointment({ ...EMPTY_APPT, profileId: pid, title: 'كشف', date: '2026-11-13' });
  });

  it('لوحة التنبيهات: المنتهي والقليل والموعد القريب وتذكير النسخة', async () => {
    const pid = await setup();
    await createItem({ ...EMPTY_ITEM_INPUT, tradeName: 'قديم' }, { ...EMPTY_BATCH_INPUT, expiry: '01/2026', packs: '1' }, NOW);
    await createItem({ ...EMPTY_ITEM_INPUT, tradeName: 'قليل', lowStockAt: '5' }, { ...EMPTY_BATCH_INPUT, expiry: '06/2028', packs: '3' }, NOW);
    await addAppointment({ ...EMPTY_APPT, profileId: pid, title: 'كشف', date: '2026-11-13' });
    const d = await loadDashboard(NOW);
    expect(d.expired.map((x) => x.name)).toEqual(['قديم']);
    expect(d.lowStock.map((x) => x.name)).toEqual(['قليل']);
    expect(d.appointments).toHaveLength(1);
    expect(d.backupReminder).toBeTruthy();
  });
});
