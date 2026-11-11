import { describe, expect, it } from 'vitest';
import { canEditProfiles, canManageMembers, canViewAllProfiles, type HouseholdRole } from './roles';

const ALL: HouseholdRole[] = ['owner', 'admin', 'member', 'viewer', 'care_follower'];

describe('الصلاحيات', () => {
  it('إدارة الأعضاء للمالك والمدير فقط', () => {
    expect(ALL.filter(canManageMembers)).toEqual(['owner', 'admin']);
  });

  it('تعديل الملفات للمالك والمدير والعضو، وليس للمشاهد أو المتابع', () => {
    expect(ALL.filter(canEditProfiles)).toEqual(['owner', 'admin', 'member']);
  });

  it('متابع الرعاية لا يرى كل الملفات', () => {
    expect(canViewAllProfiles('care_follower')).toBe(false);
    expect(canViewAllProfiles('viewer')).toBe(true);
  });
});
