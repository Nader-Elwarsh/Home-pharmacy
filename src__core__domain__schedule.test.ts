import { describe, expect, it } from 'vitest';
import { buildDoseSlots, parseTimes, slotKey, type DoseItem } from './schedule';
import { buildTimeline } from './timeline';

describe('parseTimes', () => {
  it('يرتب وينسق ويزيل التكرار', () => {
    expect(parseTimes('٢٠:٠٠، 8:00 08:00')).toEqual({ ok: true, value: ['08:00', '20:00'] });
    expect(parseTimes('')).toEqual({ ok: true, value: [] });
  });
  it('يرفض الصيغ الخاطئة والكثرة', () => {
    expect(parseTimes('8').ok).toBe(false);
    expect(parseTimes('24:00').ok).toBe(false);
    expect(parseTimes('10:60').ok).toBe(false);
    expect(parseTimes('01:00 02:00 03:00 04:00 05:00 06:00 07:00 08:00 09:00').ok).toBe(false);
  });
});

describe('buildDoseSlots', () => {
  const item: DoseItem = {
    id: 'i1',
    treatmentId: 't1',
    profileId: 'p1',
    name: 'أوجمنتين',
    times: ['08:00', '20:00'],
    startDate: '2026-11-10',
    endDate: '2026-11-12',
  };
  const TODAY = '2026-11-11';

  it('الجرعات الفائتة اليوم تظهر فائتة والقادمة قادمة', () => {
    const slots = buildDoseSlots([item], [], TODAY, TODAY, '12:00');
    expect(slots.map((s) => [s.time, s.state])).toEqual([
      ['08:00', 'overdue'],
      ['20:00', 'pending'],
    ]);
  });
  it('يظهر ما سُجّل بحالته', () => {
    const logs = [{ slotKey: slotKey('i1', TODAY, '08:00'), status: 'taken' as const }];
    const slots = buildDoseSlots([item], logs, TODAY, TODAY, '12:00');
    expect(slots[0].state).toBe('taken');
  });
  it('يوم ماضٍ بلا تسجيل = فائتة، ويوم مستقبلي = قادمة', () => {
    expect(buildDoseSlots([item], [], '2026-11-10', TODAY, '12:00').every((s) => s.state === 'overdue')).toBe(true);
    expect(buildDoseSlots([item], [], '2026-11-12', TODAY, '12:00').every((s) => s.state === 'pending')).toBe(true);
  });
  it('خارج مدة العلاج لا شيء', () => {
    expect(buildDoseSlots([item], [], '2026-11-09', TODAY, '12:00')).toEqual([]);
    expect(buildDoseSlots([item], [], '2026-11-13', TODAY, '12:00')).toEqual([]);
  });
  it('علاج مفتوح النهاية وبلا مواعيد', () => {
    const open: DoseItem = { ...item, endDate: undefined };
    expect(buildDoseSlots([open], [], '2027-01-01', TODAY, '12:00')).toHaveLength(2);
    expect(buildDoseSlots([{ ...item, times: [] }], [], TODAY, TODAY, '12:00')).toEqual([]);
  });
});

describe('buildTimeline', () => {
  const ev = (id: string, date: string) => ({ id, date, kind: 'visit' as const, title: id });
  it('يفصل القادم عن الماضي ويرتب كلًّا منهما', () => {
    const t = buildTimeline([ev('a', '2026-01-01'), ev('b', '2026-12-01'), ev('c', '2026-11-11'), ev('d', '2025-05-05'), ev('e', '2026-11-20')], '2026-11-11');
    expect(t.upcoming.map((e) => e.id)).toEqual(['c', 'e', 'b']);
    expect(t.past.map((e) => e.id)).toEqual(['a', 'd']);
  });
});
