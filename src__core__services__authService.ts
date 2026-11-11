import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import type { AuthUser } from '../domain/householdTypes';
import { auth, googleProvider } from '../firebase/firebase';

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, displayName: user.displayName, email: user.email };
}

/** يراقب حالة الدخول. يعيد دالة لإيقاف المراقبة. */
export function watchAuth(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => callback(user ? toAuthUser(user) : null));
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}
