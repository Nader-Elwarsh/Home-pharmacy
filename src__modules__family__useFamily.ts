import { useCallback, useEffect, useState } from 'react';
import { loadLocalFamily, toUserMessage, type LocalFamily } from '@/core/services/familyService';

export type FamilyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'none' }
  | { status: 'ready'; family: LocalFamily };

export function useFamily(): { state: FamilyState; reload: () => void } {
  const [state, setState] = useState<FamilyState>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadLocalFamily()
      .then((family) => {
        if (!cancelled) setState(family ? { status: 'ready', family } : { status: 'none' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: toUserMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
