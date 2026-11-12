import type { Table } from 'dexie';
import { db } from '../database/db';
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  type BackupAttachment,
  type BackupFile,
  type BackupRecord,
  type BackupTableName,
} from '../domain/backupFormat';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

function tableOf(name: BackupTableName): Table<BackupRecord, string> {
  return db.table(name) as unknown as Table<BackupRecord, string>;
}

export const backupRepository = {
  /** يقرأ كل البيانات (بما فيها المؤرشفة) لنسخة كاملة. */
  async exportAll(appVersion: string): Promise<BackupFile> {
    const tables = {} as Record<BackupTableName, BackupRecord[]>;
    for (const name of BACKUP_TABLES) tables[name] = await tableOf(name).toArray();

    const attachments: BackupAttachment[] = [];
    for (const a of await db.attachments.toArray()) {
      attachments.push({
        id: a.id,
        householdId: a.householdId,
        ownerType: a.ownerType,
        ownerId: a.ownerId,
        kind: a.kind,
        mime: a.mime,
        name: a.name,
        size: a.size,
        createdAt: a.createdAt,
        dataUrl: await blobToDataUrl(a.blob),
      });
    }

    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion,
      tables,
      attachments,
    };
  },

  /**
   * يضيف السجلات الناقصة فقط، ضمن معاملة واحدة (كلها أو لا شيء).
   * لا يحذف ولا يستبدل أي بيانات موجودة. الحركات المكررة (opId) والجرعات المكررة تُتخطى.
   */
  async restore(backup: BackupFile): Promise<{ added: number; skipped: number }> {
    // تحويل المرفقات قبل المعاملة: عمليات غير Dexie داخلها تُنهي المعاملة
    const blobs = new Map<string, Blob>();
    for (const a of backup.attachments) blobs.set(a.id, await dataUrlToBlob(a.dataUrl));

    let added = 0;
    let skipped = 0;

    await db.transaction('rw', db.tables, async () => {
      for (const name of BACKUP_TABLES) {
        const table = tableOf(name);
        const rows = backup.tables[name];
        if (rows.length === 0) continue;

        const present = await table.bulkGet(rows.map((r) => r.id));
        let fresh = rows.filter((_, i) => !present[i]);

        if (name === 'stockTransactions') {
          const used = new Set(
            (await db.stockTransactions.where('opId').anyOf(fresh.map((r) => String(r.opId))).toArray()).map((t) => t.opId),
          );
          fresh = fresh.filter((r) => !used.has(String(r.opId)));
        }
        if (name === 'doseLogs') {
          const used = new Set(
            (await db.doseLogs.where('slotKey').anyOf(fresh.map((r) => String(r.slotKey))).toArray()).map((l) => l.slotKey),
          );
          fresh = fresh.filter((r) => !used.has(String(r.slotKey)));
        }

        await table.bulkAdd(fresh);
        added += fresh.length;
        skipped += rows.length - fresh.length;
      }

      const presentAtt = await db.attachments.bulkGet(backup.attachments.map((a) => a.id));
      const freshAtt = backup.attachments.filter((_, i) => !presentAtt[i]);
      await db.attachments.bulkAdd(
        freshAtt.map((a) => ({
          id: a.id,
          householdId: a.householdId,
          ownerType: a.ownerType as 'item' | 'document' | 'prescription',
          ownerId: a.ownerId,
          kind: a.kind as 'image' | 'pdf',
          mime: a.mime,
          name: a.name,
          size: a.size,
          blob: blobs.get(a.id) as Blob,
          schemaVersion: 1,
          createdAt: a.createdAt,
          updatedAt: a.createdAt,
        })),
      );
      added += freshAtt.length;
      skipped += backup.attachments.length - freshAtt.length;
    });

    return { added, skipped };
  },
};
