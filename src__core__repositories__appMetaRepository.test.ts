import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database/db';
import { appMetaRepository } from './appMetaRepository';

beforeEach(async () => {
  await db.open();
  await db.appMeta.clear();
});

describe('appMetaRepository', () => {
  it('يعيد undefined لمفتاح غير موجود', async () => {
    expect(await appMetaRepository.get('missing')).toBeUndefined();
  });

  it('set يكتب ثم يستبدل القيمة', async () => {
    await appMetaRepository.set('a', '1');
    await appMetaRepository.set('a', '2');
    expect((await appMetaRepository.get('a'))?.value).toBe('2');
  });

  it('setIfAbsent لا يستبدل قيمة موجودة', async () => {
    const first = await appMetaRepository.setIfAbsent('b', 'first');
    const second = await appMetaRepository.setIfAbsent('b', 'second');
    expect(first.value).toBe('first');
    expect(second.value).toBe('first');
  });

  it('setIfAbsent آمن عند الاستدعاء المتزامن', async () => {
    const results = await Promise.all([
      appMetaRepository.setIfAbsent('c', 'x'),
      appMetaRepository.setIfAbsent('c', 'y'),
      appMetaRepository.setIfAbsent('c', 'z'),
    ]);
    expect(new Set(results.map((r) => r.value)).size).toBe(1);
  });

  it('remove يحذف السجل', async () => {
    await appMetaRepository.set('d', '1');
    await appMetaRepository.remove('d');
    expect(await appMetaRepository.get('d')).toBeUndefined();
  });
});
