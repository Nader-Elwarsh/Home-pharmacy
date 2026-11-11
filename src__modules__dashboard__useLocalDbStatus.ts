import { useEffect, useState } from 'react';
import { getLocalDbStatus, type LocalDbStatus } from '@/core/services/appService';

export type LocalDbState = { loading: true } | ({ loading: false } & LocalDbStatus);

export function useLocalDbStatus(): LocalDbState {
  const [state, setState] = useState<LocalDbState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    getLocalDbStatus().then((status) => {
      if (!cancelled) setState({ loading: false, ...status });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
