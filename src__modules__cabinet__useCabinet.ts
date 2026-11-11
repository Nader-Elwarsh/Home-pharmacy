import { useCallback, useEffect, useState } from 'react';
import {
  loadCabinet,
  loadItemDetail,
  toUserMessage,
  type CabinetData,
  type ItemDetail,
} from '@/core/services/inventoryService';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; data: T };

function useLoader<T>(load: () => Promise<T | null>, deps: unknown[]) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState(data ? { status: 'ready', data } : { status: 'empty' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: toUserMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [tick, ...deps]); // load يُمرَّر دائمًا كدالة تعتمد على deps فقط

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}

export function useCabinet() {
  return useLoader<CabinetData>(() => loadCabinet(), []);
}

export function useItemDetail(id: string) {
  return useLoader<ItemDetail>(() => loadItemDetail(id), [id]);
}
