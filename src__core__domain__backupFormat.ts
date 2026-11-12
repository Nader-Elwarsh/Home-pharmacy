import type { Validation } from './householdRules';

export const BACKUP_FORMAT = 'home-pharmacy-backup';
export const BACKUP_VERSION = 1;

/** الجداول المشمولة بالنسخة (appMeta خاص بالجهاز ولا يُنسخ؛ المرفقات منفصلة). */
export const BACKUP_TABLES = [
  'households',
  'profiles',
  'inventoryItems',
  'batches',
  'stockTransactions',
  'contacts',
  'visits',
  'documents',
  'prescriptions',
  'prescriptionItems',
  'treatments',
  'treatmentItems',
  'doseLogs',
  'appointments',
  'careTasks',
  'shoppingItems',
] as const;
export type BackupTableName = (typeof BACKUP_TABLES)[number];

export const BACKUP_TABLE_LABELS: Record<BackupTableName, string> = {
  households: 'المنازل',
  profiles: 'أفراد الأسرة',
  inventoryItems: 'الأدوية',
  batches: 'العبوات',
  stockTransactions: 'حركات المخزون',
  contacts: 'الدليل الشخصي',
  visits: 'الزيارات',
  documents: 'المستندات الطبية',
  prescriptions: 'الروشتات',
  prescriptionItems: 'أدوية الروشتات',
  treatments: 'العلاجات',
  treatmentItems: 'أدوية العلاجات',
  doseLogs: 'سجل الجرعات',
  appointments: 'المواعيد',
  careTasks: 'المهام',
  shoppingItems: 'المشتريات',
};

export type BackupRecord = Record<string, unknown> & { id: string };

export interface BackupAttachment {
  id: string;
  householdId: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  mime: string;
  name: string;
  size: number;
  createdAt: string;
  /** محتوى الملف بصيغة data URL */
  dataUrl: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  tables: Record<BackupTableName, BackupRecord[]>;
  attachments: BackupAttachment[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateBackup(raw: unknown): Validation<BackupFile> {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'هذا الملف ليس نسخة احتياطية من صيدلية البيت' };
  }
  const version = raw.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'رقم نسخة الملف غير صحيح' };
  }
  if (version > BACKUP_VERSION) {
    return { ok: false, error: 'هذه النسخة أنشأها إصدار أحدث من التطبيق. حدّث التطبيق أولًا' };
  }
  if (typeof raw.exportedAt !== 'string' || !isObject(raw.tables)) {
    return { ok: false, error: 'محتوى الملف ناقص أو تالف' };
  }

  const tables = {} as Record<BackupTableName, BackupRecord[]>;
  for (const name of BACKUP_TABLES) {
    const rows = raw.tables[name] ?? [];
    if (!Array.isArray(rows)) return { ok: false, error: `جدول "${BACKUP_TABLE_LABELS[name]}" تالف` };
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isObject(row) || typeof row.id !== 'string' || row.id === '') {
        return { ok: false, error: `سجل غير صالح في "${BACKUP_TABLE_LABELS[name]}"` };
      }
      if (ids.has(row.id)) return { ok: false, error: `سجل مكرر في "${BACKUP_TABLE_LABELS[name]}"` };
      ids.add(row.id);
    }
    tables[name] = rows as BackupRecord[];
  }

  const attachmentsRaw = raw.attachments ?? [];
  if (!Array.isArray(attachmentsRaw)) return { ok: false, error: 'قسم المرفقات تالف' };
  for (const a of attachmentsRaw) {
    if (
      !isObject(a) ||
      typeof a.id !== 'string' ||
      typeof a.householdId !== 'string' ||
      typeof a.dataUrl !== 'string' ||
      !a.dataUrl.startsWith('data:')
    ) {
      return { ok: false, error: 'مرفق غير صالح داخل النسخة' };
    }
  }

  return {
    ok: true,
    value: {
      format: BACKUP_FORMAT,
      formatVersion: version,
      exportedAt: raw.exportedAt,
      appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '',
      tables,
      attachments: attachmentsRaw as BackupAttachment[],
    },
  };
}

export interface RestorePlan {
  /** fresh: الجهاز بلا منزل. merge: نفس المنزل، تُضاف السجلات الناقصة فقط */
  mode: 'fresh' | 'merge';
  householdId: string;
  counts: Record<BackupTableName, number>;
  attachmentCount: number;
}

export function planRestore(backup: BackupFile, localHouseholdId: string | undefined): Validation<RestorePlan> {
  const households = backup.tables.households;
  if (households.length !== 1) {
    return { ok: false, error: 'النسخة يجب أن تحتوي على منزل واحد بالضبط' };
  }
  const householdId = households[0].id;

  for (const name of BACKUP_TABLES) {
    if (name === 'households') continue;
    if (backup.tables[name].some((r) => r.householdId !== householdId)) {
      return { ok: false, error: `بيانات "${BACKUP_TABLE_LABELS[name]}" لا تنتمي لمنزل النسخة` };
    }
  }
  if (backup.attachments.some((a) => a.householdId !== householdId)) {
    return { ok: false, error: 'مرفقات لا تنتمي لمنزل النسخة' };
  }

  let mode: RestorePlan['mode'];
  if (localHouseholdId === undefined) mode = 'fresh';
  else if (localHouseholdId === householdId) mode = 'merge';
  else {
    return {
      ok: false,
      error: 'يوجد على هذا الجهاز منزل مختلف. لا يمكن دمج منزلين الآن؛ استعد النسخة على جهاز أو متصفح فارغ',
    };
  }

  const counts = {} as Record<BackupTableName, number>;
  for (const name of BACKUP_TABLES) counts[name] = backup.tables[name].length;
  return { ok: true, value: { mode, householdId, counts, attachmentCount: backup.attachments.length } };
}
