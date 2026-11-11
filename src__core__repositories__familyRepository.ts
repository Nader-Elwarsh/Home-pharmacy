import { db, SCHEMA_VERSION, type HouseholdRecord, type ProfileRecord } from '../database/db';

export class HouseholdExistsError extends Error {}

function nowIso(): string {
  return new Date().toISOString();
}

export const familyRepository = {
  /** نموذج البيانات يدعم عدة منازل، لكن التطبيق المحلي يستخدم منزلًا واحدًا. */
  getHousehold(): Promise<HouseholdRecord | undefined> {
    return db.households.toCollection().first();
  },

  /** ينشئ المنزل إن لم يوجد أي منزل، ضمن معاملة واحدة. */
  createHousehold(name: string): Promise<HouseholdRecord> {
    return db.transaction('rw', db.households, async () => {
      if ((await db.households.count()) > 0) throw new HouseholdExistsError();
      const now = nowIso();
      const record: HouseholdRecord = {
        id: crypto.randomUUID(),
        name,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      await db.households.add(record);
      return record;
    });
  },

  async listProfiles(householdId: string): Promise<ProfileRecord[]> {
    return db.profiles
      .where('householdId')
      .equals(householdId)
      .filter((p) => !p.deletedAt)
      .sortBy('createdAt');
  },

  async addProfile(params: {
    householdId: string;
    name: string;
    birthDate?: string;
  }): Promise<ProfileRecord> {
    const now = nowIso();
    const record: ProfileRecord = {
      id: crypto.randomUUID(),
      householdId: params.householdId,
      name: params.name,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    };
    if (params.birthDate) record.birthDate = params.birthDate;
    await db.profiles.add(record);
    return record;
  },
};
