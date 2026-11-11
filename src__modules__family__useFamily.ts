import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, FamilyOverview } from '@/core/domain/householdTypes';
import { loadOverview, toUserMessage } from '@/core/services/householdService';

export type FamilyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'none' }
  | { status: 'ready'; overview: FamilyOverview };

export function useFamily(user: AuthUser): { state: FamilyState; reload: () => void } {
  const [state, setState] = useState<FamilyState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const uid = user.uid;

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadOverview(uid)
      .then((overview) => {
        if (cancelled) return;
        setState(overview ? { status: 'ready', overview } : { status: 'none' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: toUserMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
