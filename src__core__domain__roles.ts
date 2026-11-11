export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer' | 'care_follower';

export const ROLE_LABELS: Record<HouseholdRole, string> = {
  owner: 'مالك المنزل',
  admin: 'مدير المنزل',
  member: 'عضو',
  viewer: 'مشاهد',
  care_follower: 'متابع رعاية',
};

// ملاحظة: هذه الدوال لتحسين تجربة المستخدم فقط (إخفاء ما لا يملك صلاحيته).
// الفرض الفعلي للصلاحيات في firestore.rules على الخادم، ويجب أن يتطابق معه.

export function canManageMembers(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canEditProfiles(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

/** متابع الرعاية لا يرى كل الملفات؛ يرى ما أُسند إليه فقط (يُنفَّذ في P6). */
export function canViewAllProfiles(role: HouseholdRole): boolean {
  return role !== 'care_follower';
}
