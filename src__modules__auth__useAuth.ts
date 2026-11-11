import { useEffect, useState } from 'react';
import type { AuthUser } from '@/core/domain/householdTypes';
import { watchAuth } from '@/core/services/authService';

export type AuthState = { loading: true } | { loading: false; user: AuthUser | null };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true });

  useEffect(() => watchAuth((user) => setState({ loading: false, user })), []);

  return state;
}
