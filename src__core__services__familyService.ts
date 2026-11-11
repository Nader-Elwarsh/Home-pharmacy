import { UserInputError } from '../domain/errors';
import { validateBirthDate, validateName } from '../domain/householdRules';
import { familyRepository, HouseholdExistsError } from '../repositories/familyRepository';

export interface LocalFamily {
  household: { id: string; name: string };
  profiles: { id: string; name: string; birthDate?: string }[];
}

export function toUserMessage(e: unknown): string {
  if (e instanceof UserInputError) return e.message;
  return 'حدث خطأ غير متوقع. أعد المحاولة';
}

export async function createLocalHousehold(rawName: string): Promise<void> {
  const name = validateName(rawName);
  if (!name.ok) throw new UserInputError(name.error);
  try {
    await familyRepository.createHousehold(name.value);
  } catch (e) {
    if (e instanceof HouseholdExistsError) throw new UserInputError('المنزل موجود مسبقًا');
    throw e;
  }
}

/** يعيد null إن لم يُنشأ منزل بعد. */
export async function loadLocalFamily(): Promise<LocalFamily | null> {
  const household = await familyRepository.getHousehold();
  if (!household) return null;
  const profiles = await familyRepository.listProfiles(household.id);
  return {
    household: { id: household.id, name: household.name },
    profiles: profiles.map((p) => ({ id: p.id, name: p.name, birthDate: p.birthDate })),
  };
}

export async function addLocalProfile(rawName: string, rawBirthDate: string): Promise<void> {
  const household = await familyRepository.getHousehold();
  if (!household) throw new UserInputError('أنشئ المنزل أولًا');

  const name = validateName(rawName);
  if (!name.ok) throw new UserInputError(name.error);
  const birth = validateBirthDate(rawBirthDate);
  if (!birth.ok) throw new UserInputError(birth.error);

  await familyRepository.addProfile({
    householdId: household.id,
    name: name.value,
    birthDate: birth.value,
  });
}
