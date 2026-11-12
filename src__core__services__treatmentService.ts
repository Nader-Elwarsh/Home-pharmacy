import { timeString, todayString } from '../domain/dates';
import { UserInputError } from '../domain/errors';
import { TREATMENT_LABELS, validateTreatment, type TreatmentInput, type TreatmentStatus } from '../domain/healthRules';
import { buildDoseSlots, type DoseSlot, type DoseStatus } from '../domain/schedule';
import { familyRepository } from '../repositories/familyRepository';
import { healthRepository } from '../repositories/healthRepository';
import { nameMap, requireHousehold } from './common';

export interface TreatmentItemRow {
  id: string;
  name: string;
  instructions?: string;
  times: string[];
  itemId?: string;
}
export interface TreatmentRow {
  id: string;
  name: string;
  profileName: string;
  startDate: string;
  endDate?: string;
  status: TreatmentStatus;
  statusLabel: string;
  notes?: string;
  items: TreatmentItemRow[];
}

export async function addTreatment(input: TreatmentInput): Promise<void> {
  const h = await requireHousehold();
  const v = validateTreatment(input);
  if (!v.ok) throw new UserInputError(v.error);
  await healthRepository.addTreatment(h.id, v.value);
}
export const setTreatmentStatus = (id: string, s: TreatmentStatus) => healthRepository.setTreatmentStatus(id, s);
export const archiveTreatment = (id: string) => healthRepository.archiveTreatment(id);

export async function listTreatments(profileId?: string): Promise<TreatmentRow[]> {
  const h = await familyRepository.getHousehold();
  if (!h) return [];
  const [ts, items, profiles] = await Promise.all([
    healthRepository.listTreatments(h.id),
    healthRepository.listTreatmentItems(h.id),
    familyRepository.listProfiles(h.id),
  ]);
  const names = nameMap(profiles);
  return ts
    .filter((t) => !profileId || t.profileId === profileId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((t) => ({
      id: t.id,
      name: t.name,
      profileName: names.get(t.profileId) ?? '',
      startDate: t.startDate,
      endDate: t.endDate,
      status: t.status,
      statusLabel: TREATMENT_LABELS[t.status],
      notes: t.notes,
      items: items
        .filter((i) => i.treatmentId === t.id)
        .map((i) => ({ id: i.id, name: i.name, instructions: i.instructions, times: i.times, itemId: i.itemId })),
    }));
}

export interface DoseRow extends DoseSlot {
  profileName: string;
}

/** جرعات يوم معيّن للعلاجات الجارية. الجدول من إدخال المستخدم فقط، ولا علاقة له بالمخزون. */
export async function loadDoses(date?: string, now: Date = new Date()): Promise<DoseRow[]> {
  const h = await familyRepository.getHousehold();
  if (!h) return [];
  const today = todayString(now);
  const day = date ?? today;
  const [ts, items, logs, profiles] = await Promise.all([
    healthRepository.listTreatments(h.id),
    healthRepository.listTreatmentItems(h.id),
    healthRepository.listDoseLogsForDate(h.id, day),
    familyRepository.listProfiles(h.id),
  ]);
  const active = new Set(ts.filter((t) => t.status === 'active').map((t) => t.id));
  const treatmentById = new Map(ts.map((t) => [t.id, t]));
  const doseItems = items
    .filter((i) => active.has(i.treatmentId))
    .map((i) => {
      const t = treatmentById.get(i.treatmentId)!;
      return {
        id: i.id,
        treatmentId: i.treatmentId,
        profileId: i.profileId,
        name: i.name,
        times: i.times,
        startDate: t.startDate,
        endDate: t.endDate,
      };
    });
  const names = nameMap(profiles);
  return buildDoseSlots(doseItems, logs, day, today, timeString(now)).map((s) => ({
    ...s,
    profileName: names.get(s.profileId) ?? '',
  }));
}

export async function setDose(slot: DoseSlot, status: DoseStatus, reason?: string): Promise<void> {
  const h = await requireHousehold();
  await healthRepository.setDoseStatus(h.id, slot, status, reason?.trim() || undefined);
}
