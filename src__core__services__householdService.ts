import { validateBirthDate, validateName } from '../domain/householdRules';
import type { AuthUser, FamilyOverview } from '../domain/householdTypes';
import { canEditProfiles, type HouseholdRole } from '../domain/roles';
import * as repo from '../repositories/householdRepository';

export class ValidationError extends Error {}
export class PermissionError extends Error {}

/** يحول أي خطأ إلى رسالة عربية مفهومة للمستخدم. */
export function toUserMessage(e: unknown): string {
  if (e instanceof ValidationError || e instanceof PermissionError) return e.message;
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'تم إغلاق نافذة الدخول قبل اكتمالها';
  }
  if (code === 'auth/popup-blocked') return 'المتصفح منع نافذة الدخول. اسمح بالنوافذ المنبثقة وأعد المحاولة';
  if (code === 'auth/unauthorized-domain') return 'هذا الموقع غير مصرح له بالدخول في إعدادات Firebase';
  if (code.endsWith('permission-denied')) return 'ليست لديك صلاحية لهذه العملية';
  if (code.endsWith('unavailable') || code === 'auth/network-request-failed') {
    return 'تعذر الاتصال بالإنترنت. أعد المحاولة عند توفر الاتصال';
  }
  return 'حدث خطأ غير متوقع. أعد المحاولة';
}

export async function createHousehold(user: AuthUser, rawName: string): Promise<void> {
  const name = validateName(rawName);
  if (!name.ok) throw new ValidationError(name.error);
  await repo.createHouseholdWithOwner({
    uid: user.uid,
    displayName: user.displayName ?? user.email ?? '',
    name: name.value,
  });
}

/** يحمّل ملخص أول منزل للمستخدم. النموذج يدعم عدة منازل، وواجهة P1 تعرض الأول فقط. */
export async function loadOverview(uid: string): Promise<FamilyOverview | null> {
  const memberships = await repo.listMemberships(uid);
  const first = memberships[0];
  if (!first) return null;

  const [members, profiles] = await Promise.all([
    repo.listMembers(first.householdId),
    repo.listProfiles(first.householdId),
  ]);
  return {
    household: { id: first.householdId, name: first.householdName },
    role: first.role,
    members,
    profiles,
  };
}

export async function addFamilyProfile(params: {
  user: AuthUser;
  householdId: string;
  role: HouseholdRole;
  rawName: string;
  rawBirthDate: string;
}): Promise<void> {
  const { user, householdId, role, rawName, rawBirthDate } = params;
  // فحص لتجربة أفضل فقط؛ الخادم (firestore.rules) هو المرجع النهائي.
  if (!canEditProfiles(role)) throw new PermissionError('ليست لديك صلاحية إضافة أفراد');

  const name = validateName(rawName);
  if (!name.ok) throw new ValidationError(name.error);
  const birth = validateBirthDate(rawBirthDate);
  if (!birth.ok) throw new ValidationError(birth.error);

  await repo.addProfile({
    hid: householdId,
    uid: user.uid,
    name: name.value,
    birthDate: birth.value,
  });
}
