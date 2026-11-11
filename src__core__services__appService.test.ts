import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { getLocalDbStatus, recordFirstOpen } from './appService';

beforeEach(async () => {
  await db.open();
  await db.appMeta.clear();
});

describe('appService', () => {
  it('يسجل أول فتح مرة واحدة ولا يغيره لاحقًا', async () => {
    const first = await recordFirstOpen(new Date('2026-01-01T10:00:00Z'));
    const second = await recordFirstOpen(new Date('2027-05-05T10:00:00Z'));
    expect(first).toBe('2026-01-01T10:00:00.000Z');
    expect(second).toBe(first);
  });

  it('getLocalDbStatus يعيد ready عند نجاح القاعدة', async () => {
    const status = await getLocalDbStatus();
    expect(status.ready).toBe(true);
    expect(status.firstOpenAt).toBeTruthy();
  });
});
