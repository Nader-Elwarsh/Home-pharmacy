import type { AttachmentOwnerType } from '../database/db';
import { todayString } from '../domain/dates';
import { UserInputError } from '../domain/errors';
import {
  matchesDoc,
  rxAvailability,
  validateDoc,
  validateRx,
  validateVisit,
  AVAILABILITY_LABELS,
  DISPENSE_LABELS,
  DOC_LABELS,
  type Availability,
  type DispenseStatus,
  type DocInput,
  type RxInput,
  type VisitInput,
} from '../domain/healthRules';
import { buildTimeline, type Timeline, type TimelineEvent } from '../domain/timeline';
import { familyRepository } from '../repositories/familyRepository';
import { healthRepository } from '../repositories/healthRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { balanceByBatch } from '../domain/stock';
import { removeAttachment, saveFiles } from './attachmentService';
import { nameMap, requireHousehold } from './common';

export interface ProfileOption {
  id: string;
  name: string;
}

export async function listProfileOptions(): Promise<ProfileOption[]> {
  const h = await familyRepository.getHousehold();
  if (!h) return [];
  return (await familyRepository.listProfiles(h.id)).map((p) => ({ id: p.id, name: p.name }));
}

export interface PickOption {
  id: string;
  label: string;
}

/** خيارات الربط في النماذج: الأطباء/الجهات، الزيارات، أصناف الخزانة. */
export async function loadLinkOptions(): Promise<{
  contacts: PickOption[];
  visits: PickOption[];
  items: PickOption[];
  prescriptions: PickOption[];
}> {
  const h = await familyRepository.getHousehold();
  if (!h) return { contacts: [], visits: [], items: [], prescriptions: [] };
  const [contacts, visits, items, rxs, profiles] = await Promise.all([
    healthRepository.listContacts(h.id),
    healthRepository.listVisits(h.id),
    inventoryRepository.listItems(h.id),
    healthRepository.listPrescriptions(h.id),
    familyRepository.listProfiles(h.id),
  ]);
  const names = nameMap(profiles);
  return {
    contacts: contacts.map((c) => ({ id: c.id, label: c.name })),
    visits: visits
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((v) => ({ id: v.id, label: `${v.date} — ${names.get(v.profileId) ?? ''}${v.reason ? ` — ${v.reason}` : ''}` })),
    items: items.map((i) => ({ id: i.id, label: i.tradeName })),
    prescriptions: rxs
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({ id: r.id, label: `${r.date} — ${names.get(r.profileId) ?? ''}` })),
  };
}

// ===== الزيارات =====
export async function addVisit(input: VisitInput, now: Date = new Date()): Promise<void> {
  const h = await requireHousehold();
  const v = validateVisit(input, todayString(now));
  if (!v.ok) throw new UserInputError(v.error);
  await healthRepository.addVisit(h.id, v.value);
}
export const archiveVisit = (id: string) => healthRepository.archiveVisit(id);

// ===== المستندات =====
export interface DocRow {
  id: string;
  title: string;
  kindLabel: string;
  date: string;
  facility?: string;
  notes?: string;
  tags?: string;
  attachmentIds: string[];
}

export async function addDocument(input: DocInput, files: File[], now: Date = new Date()): Promise<void> {
  const h = await requireHousehold();
  const v = validateDoc(input, todayString(now), files.length);
  if (!v.ok) throw new UserInputError(v.error);
  const ids = await saveFiles(files, 'document' as AttachmentOwnerType, crypto.randomUUID());
  await healthRepository.addDocument(h.id, v.value, ids);
}

export async function archiveDocument(id: string, attachmentIds: string[]): Promise<void> {
  await healthRepository.archiveDocument(id);
  for (const a of attachmentIds) await removeAttachment(a);
}

export async function searchDocuments(profileId: string, query: string): Promise<DocRow[]> {
  const h = await familyRepository.getHousehold();
  if (!h) return [];
  const docs = await healthRepository.listDocuments(h.id);
  return docs
    .filter((d) => d.profileId === profileId && matchesDoc(d, query))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => ({
      id: d.id,
      title: d.title,
      kindLabel: DOC_LABELS[d.kind],
      date: d.date,
      facility: d.facility,
      notes: d.notes,
      tags: d.tags,
      attachmentIds: d.attachmentIds,
    }));
}

// ===== الروشتات =====
export interface RxItemRow {
  id: string;
  writtenName: string;
  strength?: string;
  qty?: string;
  instructions?: string;
  duration?: string;
  dispenseStatus: DispenseStatus;
  dispenseLabel: string;
  availability: Availability;
  availabilityLabel: string;
  linkedItemId?: string;
}
export interface RxRow {
  id: string;
  date: string;
  reason?: string;
  notes?: string;
  contactName?: string;
  attachmentIds: string[];
  items: RxItemRow[];
}

export async function addPrescription(input: RxInput, files: File[], now: Date = new Date()): Promise<void> {
  const h = await requireHousehold();
  const v = validateRx(input, todayString(now), files.length);
  if (!v.ok) throw new UserInputError(v.error);
  const ids = await saveFiles(files, 'prescription' as AttachmentOwnerType, crypto.randomUUID());
  await healthRepository.addPrescription(h.id, v.value, ids);
}

export async function archivePrescription(id: string, attachmentIds: string[]): Promise<void> {
  await healthRepository.archivePrescription(id);
  for (const a of attachmentIds) await removeAttachment(a);
}

export const setDispenseStatus = (id: string, s: DispenseStatus) => healthRepository.setDispenseStatus(id, s);

export async function listPrescriptions(profileId: string): Promise<RxRow[]> {
  const h = await familyRepository.getHousehold();
  if (!h) return [];
  const [rxs, rxItems, contacts, batches, txs] = await Promise.all([
    healthRepository.listPrescriptions(h.id),
    healthRepository.listPrescriptionItems(h.id),
    healthRepository.listContacts(h.id),
    inventoryRepository.listBatches(h.id),
    inventoryRepository.listTransactions(h.id),
  ]);
  const balances = balanceByBatch(txs);
  const totals = new Map<string, number>();
  for (const b of batches) totals.set(b.itemId, (totals.get(b.itemId) ?? 0) + (balances.get(b.id) ?? 0));
  const contactNames = nameMap(contacts.map((c) => ({ id: c.id, name: c.name })));

  return rxs
    .filter((r) => r.profileId === profileId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({
      id: r.id,
      date: r.date,
      reason: r.reason,
      notes: r.notes,
      contactName: r.contactId ? contactNames.get(r.contactId) : undefined,
      attachmentIds: r.attachmentIds,
      items: rxItems
        .filter((i) => i.prescriptionId === r.id)
        .map((i) => {
          const qty = i.itemId ? totals.get(i.itemId) ?? 0 : undefined;
          const availability = rxAvailability(qty);
          return {
            id: i.id,
            writtenName: i.writtenName,
            strength: i.strength,
            qty: i.qty,
            instructions: i.instructions,
            duration: i.duration,
            dispenseStatus: i.dispenseStatus,
            dispenseLabel: DISPENSE_LABELS[i.dispenseStatus],
            availability,
            availabilityLabel: AVAILABILITY_LABELS[availability],
            linkedItemId: i.itemId,
          };
        }),
    }));
}

// ===== ملف الفرد: الخط الزمني =====
export interface VisitRow {
  id: string;
  date: string;
  reason?: string;
  notes?: string;
  contactName?: string;
}

export interface ProfileOverview {
  profileId: string;
  name: string;
  timeline: Timeline;
  visits: VisitRow[];
}

export async function loadProfileOverview(profileId: string, now: Date = new Date()): Promise<ProfileOverview | null> {
  const h = await familyRepository.getHousehold();
  if (!h) return null;
  const profiles = await familyRepository.listProfiles(h.id);
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return null;

  const [visits, docs, rxs, treatments, appts, contacts] = await Promise.all([
    healthRepository.listVisits(h.id),
    healthRepository.listDocuments(h.id),
    healthRepository.listPrescriptions(h.id),
    healthRepository.listTreatments(h.id),
    healthRepository.listAppointments(h.id),
    healthRepository.listContacts(h.id),
  ]);
  const contactNames = nameMap(contacts.map((c) => ({ id: c.id, name: c.name })));
  const mine = <T extends { profileId: string }>(rows: T[]) => rows.filter((r) => r.profileId === profileId);

  const events: TimelineEvent[] = [];
  for (const v of mine(visits)) {
    events.push({ id: `v-${v.id}`, date: v.date, kind: 'visit', title: v.reason ?? 'زيارة', subtitle: v.contactId ? contactNames.get(v.contactId) : undefined });
  }
  for (const d of mine(docs)) {
    events.push({ id: `d-${d.id}`, date: d.date, kind: 'document', title: d.title, subtitle: DOC_LABELS[d.kind] });
  }
  for (const r of mine(rxs)) {
    events.push({ id: `r-${r.id}`, date: r.date, kind: 'prescription', title: r.reason ?? 'روشتة', subtitle: r.contactId ? contactNames.get(r.contactId) : undefined });
  }
  for (const t of mine(treatments)) {
    events.push({ id: `ts-${t.id}`, date: t.startDate, kind: 'treatment_start', title: t.name });
    if (t.endDate) events.push({ id: `te-${t.id}`, date: t.endDate, kind: 'treatment_end', title: t.name });
  }
  for (const a of mine(appts).filter((x) => x.status !== 'cancelled')) {
    events.push({ id: `a-${a.id}`, date: a.date, kind: 'appointment', title: a.title, subtitle: a.time });
  }

  return {
    profileId,
    name: profile.name,
    timeline: buildTimeline(events, todayString(now)),
    visits: mine(visits)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((v) => ({
        id: v.id,
        date: v.date,
        reason: v.reason,
        notes: v.notes,
        contactName: v.contactId ? contactNames.get(v.contactId) : undefined,
      })),
  };
}
