import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  planRestore,
  validateBackup,
  type BackupFile,
} from './backupFormat';
import { filterReportRows, reportToText, REPORT_DISCLAIMER, type ReportRow, type ReportScope } from './report';

const row = (over: Partial<ReportRow> = {}): ReportRow => ({
  itemId: 'i',
  name: 'بنادول',
  qtyText: '2 علبة',
  packState: 'sealed',
  expiryText: '06/2027',
  expiryStatus: 'ok',
  ...over,
});
const scope = (over: Partial<ReportScope> = {}): ReportScope => ({
  openedOnly: false,
  expiringOnly: false,
  includeExpired: false,
  ...over,
});

describe('filterReportRows', () => {
  const rows = [
    row({ itemId: '1', profileId: 'p1' }),
    row({ itemId: '2', profileId: 'p2', packState: 'opened' }),
    row({ itemId: '3', expiryStatus: 'expired' }),
    row({ itemId: '4', expiryStatus: 'expiring_soon' }),
  ];
  const ids = (r: ReportRow[]) => r.map((x) => x.itemId);

  it('المنزل كله بدون المنتهي افتراضيًا', () => {
    expect(ids(filterReportRows(rows, scope()))).toEqual(['1', '2', '4']);
    expect(ids(filterReportRows(rows, scope({ includeExpired: true })))).toEqual(['1', '2', '3', '4']);
  });
  it('فرد معين', () => {
    expect(ids(filterReportRows(rows, scope({ profileId: 'p1' })))).toEqual(['1']);
  });
  it('المفتوح فقط والقريب من الانتهاء فقط', () => {
    expect(ids(filterReportRows(rows, scope({ openedOnly: true })))).toEqual(['2']);
    expect(ids(filterReportRows(rows, scope({ expiringOnly: true })))).toEqual(['4']);
    expect(ids(filterReportRows(rows, scope({ expiringOnly: true, includeExpired: true })))).toEqual(['3', '4']);
  });
});

describe('reportToText', () => {
  const meta = { householdName: 'بيتنا', dateText: '2026-11-11' };
  it('يحتوي التنبيه وتاريخ الإصدار ويخفي ما لم يُطلب', () => {
    const text = reportToText([row({ batchNo: 'A1', notes: 'سر' })], meta, { includeBatchNo: false, includeNotes: false });
    expect(text).toContain('بنادول');
    expect(text).toContain('تاريخ الإصدار: 2026-11-11');
    expect(text).toContain(REPORT_DISCLAIMER);
    expect(text).not.toContain('A1');
    expect(text).not.toContain('سر');
  });
  it('يُظهر التشغيلة والملاحظات عند الطلب', () => {
    const text = reportToText([row({ batchNo: 'A1', notes: 'سر' })], meta, { includeBatchNo: true, includeNotes: true });
    expect(text).toContain('تشغيلة: A1');
    expect(text).toContain('ملاحظات: سر');
  });
  it('تقرير فارغ', () => {
    expect(reportToText([], meta, { includeBatchNo: false, includeNotes: false })).toContain('لا توجد أدوية مطابقة');
  });
});

function makeBackup(over: Record<string, unknown> = {}): Record<string, unknown> {
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) tables[t] = [];
  tables.households = [{ id: 'h1', name: 'بيتنا' }];
  tables.profiles = [{ id: 'p1', householdId: 'h1', name: 'أحمد' }];
  return { format: BACKUP_FORMAT, formatVersion: 1, exportedAt: '2026-11-11T00:00:00.000Z', appVersion: '0', tables, attachments: [], ...over };
}

describe('validateBackup', () => {
  it('يقبل نسخة سليمة ويكمل الجداول الناقصة', () => {
    const b = makeBackup();
    delete (b.tables as Record<string, unknown>).visits;
    const r = validateBackup(b);
    expect(r.ok && r.value.tables.visits).toEqual([]);
    expect(r.ok && r.value.tables.profiles).toHaveLength(1);
  });
  it('يرفض ما ليس نسخة ونسخة أحدث وجدولًا تالفًا وسجلًا بلا معرّف ومعرّفًا مكررًا', () => {
    expect(validateBackup({ hello: 1 }).ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup(makeBackup({ formatVersion: 99 })).ok).toBe(false);
    expect(validateBackup(makeBackup({ formatVersion: 0 })).ok).toBe(false);
    const bad = makeBackup();
    (bad.tables as Record<string, unknown>).profiles = 'x';
    expect(validateBackup(bad).ok).toBe(false);
    const noId = makeBackup();
    (noId.tables as Record<string, unknown>).profiles = [{ name: 'x' }];
    expect(validateBackup(noId).ok).toBe(false);
    const dup = makeBackup();
    (dup.tables as Record<string, unknown>).profiles = [{ id: 'a', householdId: 'h1' }, { id: 'a', householdId: 'h1' }];
    expect(validateBackup(dup).ok).toBe(false);
  });
  it('يرفض مرفقًا بلا data URL', () => {
    expect(validateBackup(makeBackup({ attachments: [{ id: 'a', householdId: 'h1', dataUrl: 'http://x' }] })).ok).toBe(false);
  });
});

describe('planRestore', () => {
  const backup = (): BackupFile => {
    const r = validateBackup(makeBackup());
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  it('جهاز فارغ = استعادة جديدة، ونفس المنزل = دمج، ومنزل مختلف = رفض', () => {
    const fresh = planRestore(backup(), undefined);
    expect(fresh.ok && fresh.value.mode).toBe('fresh');
    expect(fresh.ok && fresh.value.counts.profiles).toBe(1);
    const merge = planRestore(backup(), 'h1');
    expect(merge.ok && merge.value.mode).toBe('merge');
    expect(planRestore(backup(), 'other').ok).toBe(false);
  });
  it('يرفض سجلًا من منزل آخر وغياب المنزل', () => {
    const b = backup();
    b.tables.profiles = [{ id: 'p9', householdId: 'zzz' }];
    expect(planRestore(b, undefined).ok).toBe(false);
    const empty = backup();
    empty.tables.households = [];
    expect(planRestore(empty, undefined).ok).toBe(false);
  });
});
