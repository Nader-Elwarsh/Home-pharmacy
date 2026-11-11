import { appMetaRepository } from '../repositories/appMetaRepository';

export const FIRST_OPEN_KEY = 'firstOpenAt';

/** يسجل أول فتح للتطبيق على هذا الجهاز مرة واحدة فقط، ويعيد وقته (UTC ISO). */
export async function recordFirstOpen(now: Date = new Date()): Promise<string> {
  const record = await appMetaRepository.setIfAbsent(FIRST_OPEN_KEY, now.toISOString());
  return record.value;
}

export interface LocalDbStatus {
  ready: boolean;
  firstOpenAt?: string;
  error?: string;
}

export async function getLocalDbStatus(): Promise<LocalDbStatus> {
  try {
    const firstOpenAt = await recordFirstOpen();
    return { ready: true, firstOpenAt };
  } catch (e) {
    return { ready: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
