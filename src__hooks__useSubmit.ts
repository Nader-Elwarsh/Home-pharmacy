import { useCallback, useState } from 'react';
import { toUserMessage } from '@/core/services/familyService';

/** يغلّف إرسال نموذج: busy ورسالة خطأ مفهومة. يعيد true عند النجاح. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(toUserMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
