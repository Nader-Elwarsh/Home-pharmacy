import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { MemberView, ProfileView } from '../domain/householdTypes';
import type { HouseholdRole } from '../domain/roles';
import { firestore } from '../firebase/firebase';

const SCHEMA_VERSION = 1;

export interface MembershipRecord {
  householdId: string;
  householdName: string;
  role: HouseholdRole;
}

/** ينشئ المنزل وعضوية المالك وفهرس العضويات في دفعة واحدة (كلها أو لا شيء). */
export async function createHouseholdWithOwner(params: {
  uid: string;
  displayName: string;
  name: string;
}): Promise<string> {
  const { uid, displayName, name } = params;
  const householdRef = doc(collection(firestore, 'households'));
  const hid = householdRef.id;

  const batch = writeBatch(firestore);
  batch.set(householdRef, {
    id: hid,
    name,
    ownerUid: uid,
    plan: 'free',
    schemaVersion: SCHEMA_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(firestore, 'households', hid, 'members', uid), {
    uid,
    role: 'owner',
    displayName,
    status: 'active',
    schemaVersion: SCHEMA_VERSION,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(firestore, 'users', uid, 'memberships', hid), {
    householdId: hid,
    householdName: name,
    role: 'owner',
    schemaVersion: SCHEMA_VERSION,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return hid;
}

export async function listMemberships(uid: string): Promise<MembershipRecord[]> {
  const snap = await getDocs(collection(firestore, 'users', uid, 'memberships'));
  return snap.docs.map((d) => d.data() as MembershipRecord);
}

export async function listMembers(hid: string): Promise<MemberView[]> {
  const snap = await getDocs(collection(firestore, 'households', hid, 'members'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid as string,
      role: data.role as HouseholdRole,
      displayName: (data.displayName as string) || '',
    };
  });
}

export async function listProfiles(hid: string): Promise<ProfileView[]> {
  const snap = await getDocs(
    query(collection(firestore, 'households', hid, 'profiles'), orderBy('createdAt')),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    const view: ProfileView = { id: data.id as string, name: data.name as string };
    if (typeof data.birthDate === 'string') view.birthDate = data.birthDate;
    return view;
  });
}

export async function addProfile(params: {
  hid: string;
  uid: string;
  name: string;
  birthDate?: string;
}): Promise<void> {
  const { hid, uid, name, birthDate } = params;
  const ref = doc(collection(firestore, 'households', hid, 'profiles'));
  // Firestore لا يقبل undefined، فلا نضيف الحقل الاختياري إلا إن وُجد.
  const data: Record<string, unknown> = {
    id: ref.id,
    householdId: hid,
    name,
    createdBy: uid,
    schemaVersion: SCHEMA_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (birthDate) data.birthDate = birthDate;
  await setDoc(ref, data);
}
