import {
  db,
  type AppointmentRecord,
  type CareTaskRecord,
  type ContactRecord,
  type DocumentRecord,
  type DoseLogRecord,
  type PrescriptionItemRecord,
  type PrescriptionRecord,
  type ShoppingItemRecord,
  type TreatmentItemRecord,
  type TreatmentRecord,
  type VisitRecord,
} from '../database/db';
import type {
  ApptData,
  ContactData,
  DocData,
  RxData,
  ShoppingData,
  TaskData,
  TreatmentData,
  VisitData,
} from '../domain/healthRules';
import type { DoseStatus } from '../domain/schedule';
import { addRecord, archiveRecord, listActive, makeRecord, nowIso, patchRecord } from './records';

export const healthRepository = {
  // ===== الدليل الشخصي =====
  listContacts: (hid: string) => listActive(db.contacts, hid),
  addContact: (hid: string, d: ContactData) =>
    addRecord<ContactRecord>(db.contacts, hid, { ...d, favorite: false }),
  setFavorite: (id: string, favorite: boolean) => patchRecord(db.contacts, id, { favorite }),
  archiveContact: (id: string) => archiveRecord(db.contacts, id),

  // ===== الزيارات =====
  listVisits: (hid: string) => listActive(db.visits, hid),
  addVisit: (hid: string, d: VisitData) => addRecord<VisitRecord>(db.visits, hid, d),
  archiveVisit: (id: string) => archiveRecord(db.visits, id),

  // ===== المستندات =====
  listDocuments: (hid: string) => listActive(db.documents, hid),
  addDocument: (hid: string, d: DocData, attachmentIds: string[]) =>
    addRecord<DocumentRecord>(db.documents, hid, { ...d, attachmentIds }),
  archiveDocument: (id: string) => archiveRecord(db.documents, id),

  // ===== الروشتات =====
  listPrescriptions: (hid: string) => listActive(db.prescriptions, hid),
  listPrescriptionItems: (hid: string) => listActive(db.prescriptionItems, hid),

  /** الروشتة وأدويتها في معاملة واحدة. */
  addPrescription(hid: string, d: RxData, attachmentIds: string[]): Promise<string> {
    return db.transaction('rw', db.prescriptions, db.prescriptionItems, async () => {
      const { items, ...head } = d;
      const rx = await addRecord<PrescriptionRecord>(db.prescriptions, hid, { ...head, attachmentIds });
      for (const item of items) {
        await addRecord<PrescriptionItemRecord>(db.prescriptionItems, hid, { ...item, prescriptionId: rx.id });
      }
      return rx.id;
    });
  },
  setDispenseStatus: (id: string, dispenseStatus: PrescriptionItemRecord['dispenseStatus']) =>
    patchRecord(db.prescriptionItems, id, { dispenseStatus }),
  archivePrescription: (id: string) =>
    db.transaction('rw', db.prescriptions, db.prescriptionItems, async () => {
      await archiveRecord(db.prescriptions, id);
      await db.prescriptionItems.where('prescriptionId').equals(id).modify({ deletedAt: nowIso() });
    }),

  // ===== العلاجات =====
  listTreatments: (hid: string) => listActive(db.treatments, hid),
  listTreatmentItems: (hid: string) => listActive(db.treatmentItems, hid),

  addTreatment(hid: string, d: TreatmentData): Promise<string> {
    return db.transaction('rw', db.treatments, db.treatmentItems, async () => {
      const { items, ...head } = d;
      const t = await addRecord<TreatmentRecord>(db.treatments, hid, { ...head, status: 'active' });
      for (const item of items) {
        await addRecord<TreatmentItemRecord>(db.treatmentItems, hid, {
          ...item,
          treatmentId: t.id,
          profileId: d.profileId,
        });
      }
      return t.id;
    });
  },
  setTreatmentStatus: (id: string, status: TreatmentRecord['status']) =>
    patchRecord(db.treatments, id, { status }),
  archiveTreatment: (id: string) =>
    db.transaction('rw', db.treatments, db.treatmentItems, async () => {
      await archiveRecord(db.treatments, id);
      await db.treatmentItems.where('treatmentId').equals(id).modify({ deletedAt: nowIso() });
    }),

  // ===== الجرعات: لا علاقة لها بالمخزون =====
  listDoseLogsForDate: (hid: string, date: string) =>
    db.doseLogs
      .where('date')
      .equals(date)
      .filter((l) => l.householdId === hid && !l.deletedAt)
      .toArray(),

  /** سجل واحد لكل موعد: التسجيل مرة ثانية يحدّث الحالة (لا تكرار). */
  setDoseStatus(
    hid: string,
    slot: { slotKey: string; treatmentItemId: string; treatmentId: string; profileId: string; date: string; time: string },
    status: DoseStatus,
    reason?: string,
  ): Promise<void> {
    return db.transaction('rw', db.doseLogs, async () => {
      const existing = await db.doseLogs.where('slotKey').equals(slot.slotKey).first();
      if (existing) {
        await patchRecord<DoseLogRecord>(db.doseLogs, existing.id, { status, reason });
        return;
      }
      const rec = makeRecord<DoseLogRecord>(hid, {
        treatmentItemId: slot.treatmentItemId,
        treatmentId: slot.treatmentId,
        profileId: slot.profileId,
        date: slot.date,
        time: slot.time,
        slotKey: slot.slotKey,
        status,
        ...(reason ? { reason } : {}),
      });
      await db.doseLogs.add(rec);
    });
  },

  // ===== المواعيد والمهام =====
  listAppointments: (hid: string) => listActive(db.appointments, hid),
  addAppointment: (hid: string, d: ApptData) =>
    addRecord<AppointmentRecord>(db.appointments, hid, { ...d, status: 'upcoming' }),
  setAppointmentStatus: (id: string, status: AppointmentRecord['status']) =>
    patchRecord(db.appointments, id, { status }),
  archiveAppointment: (id: string) => archiveRecord(db.appointments, id),

  listTasks: (hid: string) => listActive(db.careTasks, hid),
  addTask: (hid: string, d: TaskData) => addRecord<CareTaskRecord>(db.careTasks, hid, { ...d, status: 'open' }),
  setTaskDone: (id: string, done: boolean) =>
    patchRecord(db.careTasks, id, { status: done ? 'done' : 'open', doneAt: done ? nowIso() : undefined }),
  archiveTask: (id: string) => archiveRecord(db.careTasks, id),

  // ===== المشتريات =====
  listShopping: (hid: string) => listActive(db.shoppingItems, hid),
  addShopping: (hid: string, d: ShoppingData, itemId?: string) =>
    addRecord<ShoppingItemRecord>(db.shoppingItems, hid, { ...d, ...(itemId ? { itemId } : {}), status: 'pending' }),
  setShoppingBought: (id: string, bought: boolean) =>
    patchRecord(db.shoppingItems, id, { status: bought ? 'bought' : 'pending' }),
  archiveShopping: (id: string) => archiveRecord(db.shoppingItems, id),
};
