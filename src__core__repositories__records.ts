import type { Table, UpdateSpec } from 'dexie';
import { SCHEMA_VERSION, type BaseRecord } from '../database/db';

let lastMs = 0;

/**
 * وقت UTC بصيغة ISO، ويزداد دائمًا بمقدار 1 مللي ثانية على الأقل بين استدعاءين،
 * فلا يتساوى وقتا سجلين متتاليين ويثبت ترتيب العرض بحسب الإضافة.
 */
export function nowIso(): string {
  const now = Date.now();
  lastMs = now > lastMs ? now : lastMs + 1;
  return new Date(lastMs).toISOString();
}

export function makeRecord<T extends BaseRecord>(
  householdId: string,
  data: Omit<T, keyof BaseRecord>,
): T {
  const now = nowIso();
  return {
    ...data,
    id: crypto.randomUUID(),
    householdId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  } as unknown as T;
}

export async function addRecord<T extends BaseRecord>(
  table: Table<T, string>,
  householdId: string,
  data: Omit<T, keyof BaseRecord>,
): Promise<T> {
  const record = makeRecord<T>(householdId, data);
  await table.add(record);
  return record;
}

export function listActive<T extends BaseRecord>(
  table: Table<T, string>,
  householdId: string,
): Promise<T[]> {
  return table
    .where('householdId')
    .equals(householdId)
    .filter((r) => !r.deletedAt)
    .toArray();
}

export async function patchRecord<T extends BaseRecord>(
  table: Table<T, string>,
  id: string,
  changes: Partial<T>,
): Promise<void> {
  await table.update(id, { ...changes, updatedAt: nowIso() } as UpdateSpec<T>);
}

/** أرشفة (لا حذف نهائي). */
export function archiveRecord<T extends BaseRecord>(table: Table<T, string>, id: string): Promise<void> {
  return patchRecord(table, id, { deletedAt: nowIso() } as Partial<T>);
}
