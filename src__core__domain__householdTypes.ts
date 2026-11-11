import type { HouseholdRole } from './roles';

export interface MemberView {
  uid: string;
  role: HouseholdRole;
  displayName: string;
}

export interface ProfileView {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  birthDate?: string;
}

export interface FamilyOverview {
  household: { id: string; name: string };
  role: HouseholdRole;
  members: MemberView[];
  profiles: ProfileView[];
}

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}
