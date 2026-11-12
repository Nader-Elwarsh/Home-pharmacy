import { UserInputError } from '../domain/errors';
import {
  APPT_LABELS,
  PRIORITY_LABELS,
  validateAppt,
  validateShopping,
  validateTask,
  type ApptInput,
  type Priority,
  type ShoppingInput,
  type TaskInput,
} from '../domain/healthRules';
import { familyRepository } from '../repositories/familyRepository';
import { healthRepository } from '../repositories/healthRepository';
import { nameMap, requireHousehold } from './common';

export interface ApptRow {
  id: string;
  title: string;
  kindLabel: string;
  date: string;
  time?: string;
  profileName: string;
  status: 'upcoming' | 'done' | 'cancelled';
  notes?: string;
}
export interface TaskRow {
  id: string;
  title: string;
  profileName?: string;
  dueDate?: string;
  done: boolean;
}
export interface ShoppingRow {
  id: string;
  name: string;
  qty?: string;
  profileName?: string;
  priority: Priority;
  priorityLabel: string;
  reason?: string;
  bought: boolean;
}

async function ctx() {
  const h = await requireHousehold();
  const names = nameMap(await familyRepository.listProfiles(h.id));
  return { h, names };
}

export async function addAppointment(input: ApptInput): Promise<void> {
  const h = await requireHousehold();
  const v = validateAppt(input);
  if (!v.ok) throw new UserInputError(v.error);
  await healthRepository.addAppointment(h.id, v.value);
}
export const setAppointmentStatus = healthRepository.setAppointmentStatus;
export const archiveAppointment = healthRepository.archiveAppointment;

export async function listAppointments(): Promise<ApptRow[]> {
  const { h, names } = await ctx();
  const rows = await healthRepository.listAppointments(h.id);
  return rows
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .map((a) => ({
      id: a.id,
      title: a.title,
      kindLabel: APPT_LABELS[a.kind],
      date: a.date,
      time: a.time,
      profileName: names.get(a.profileId) ?? '',
      status: a.status,
      notes: a.notes,
    }));
}

export async function addTask(input: TaskInput): Promise<void> {
  const h = await requireHousehold();
  const v = validateTask(input);
  if (!v.ok) throw new UserInputError(v.error);
  await healthRepository.addTask(h.id, v.value);
}
export const setTaskDone = healthRepository.setTaskDone;
export const archiveTask = healthRepository.archiveTask;

export async function listTasks(): Promise<TaskRow[]> {
  const { h, names } = await ctx();
  const rows = await healthRepository.listTasks(h.id);
  return rows
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
    .map((t) => ({
      id: t.id,
      title: t.title,
      profileName: t.profileId ? names.get(t.profileId) : undefined,
      dueDate: t.dueDate,
      done: t.status === 'done',
    }));
}

export async function addShopping(input: ShoppingInput, itemId?: string): Promise<void> {
  const h = await requireHousehold();
  const v = validateShopping(input);
  if (!v.ok) throw new UserInputError(v.error);
  await healthRepository.addShopping(h.id, v.value, itemId);
}
export const setShoppingBought = healthRepository.setShoppingBought;
export const archiveShopping = healthRepository.archiveShopping;

export async function listShopping(): Promise<ShoppingRow[]> {
  const { h, names } = await ctx();
  const rows = await healthRepository.listShopping(h.id);
  return rows
    .sort((a, b) => Number(a.status === 'bought') - Number(b.status === 'bought') || (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
    .map((s) => ({
      id: s.id,
      name: s.name,
      qty: s.qty,
      profileName: s.profileId ? names.get(s.profileId) : undefined,
      priority: s.priority,
      priorityLabel: PRIORITY_LABELS[s.priority],
      reason: s.reason,
      bought: s.status === 'bought',
    }));
}
