import { useCallback, useEffect, useRef, useState } from 'react';
import { toUserMessage } from '@/core/services/familyService';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; data: T };

/** يحمّل بيانات من خدمة. null = لا توجد بيانات. reload يعيد التحميل بعد أي تعديل. */
export function useLoader<T>(load: () => Promise<T | null>, deps: ReadonlyArray<unknown>) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setState(data ? { status: 'ready', data } : { status: 'empty' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: toUserMessage(e) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
