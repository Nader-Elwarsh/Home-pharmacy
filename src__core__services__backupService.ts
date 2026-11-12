import { UserInputError } from '../domain/errors';
import { planRestore, validateBackup, type BackupFile, type RestorePlan } from '../domain/backupFormat';
import { appMetaRepository } from '../repositories/appMetaRepository';
import { backupRepository } from '../repositories/backupRepository';
import { familyRepository } from '../repositories/familyRepository';
import { LAST_BACKUP_KEY } from './dashboardService';

export const APP_VERSION = '0.4.0';

export interface BackupExport {
  filename: string;
  blob: Blob;
}

export async function exportBackup(now: Date = new Date()): Promise<BackupExport> {
  const h = await familyRepository.getHousehold();
  if (!h) throw new UserInputError('لا توجد بيانات لحفظها بعد');
  const data = await backupRepository.exportAll(APP_VERSION);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await appMetaRepository.set(LAST_BACKUP_KEY, now.toISOString());
  return { filename: `home-pharmacy-backup-${now.toISOString().slice(0, 10)}.json`, blob };
}

export interface RestorePreview {
  backup: BackupFile;
  plan: RestorePlan;
  exportedAt: string;
}

export async function previewBackup(file: File): Promise<RestorePreview> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new UserInputError('تعذر قراءة الملف. تأكد أنه ملف نسخة احتياطية سليم');
  }
  const v = validateBackup(raw);
  if (!v.ok) throw new UserInputError(v.error);
  const local = await familyRepository.getHousehold();
  const plan = planRestore(v.value, local?.id);
  if (!plan.ok) throw new UserInputError(plan.error);
  return { backup: v.value, plan: plan.value, exportedAt: v.value.exportedAt };
}

export async function restoreBackup(preview: RestorePreview): Promise<{ added: number; skipped: number }> {
  return backupRepository.restore(preview.backup);
}

export async function lastBackupAt(): Promise<string | undefined> {
  return (await appMetaRepository.get(LAST_BACKUP_KEY))?.value;
}
