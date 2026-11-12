import type { HouseholdRecord } from '../database/db';
import { UserInputError } from '../domain/errors';
import { familyRepository } from '../repositories/familyRepository';

export async function requireHousehold(): Promise<HouseholdRecord> {
  const household = await familyRepository.getHousehold();
  if (!household) throw new UserInputError('أنشئ المنزل أولًا من صفحة الأسرة');
  return household;
}

export function nameMap(rows: ReadonlyArray<{ id: string; name: string }>): Map<string, string> {
  return new Map(rows.map((r) => [r.id, r.name]));
}
