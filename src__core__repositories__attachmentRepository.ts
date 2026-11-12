import { db, type AttachmentOwnerType, type AttachmentRecord } from '../database/db';
import { addRecord, archiveRecord } from './records';

export interface NewAttachment {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  kind: 'image' | 'pdf';
  mime: string;
  name: string;
  blob: Blob;
}

export const attachmentRepository = {
  /** يضيف ملفات ويعيد معرّفاتها بالترتيب. تُستدعى بعد الضغط (خارج أي معاملة). */
  async addMany(householdId: string, files: NewAttachment[]): Promise<string[]> {
    const ids: string[] = [];
    for (const f of files) {
      const rec = await addRecord<AttachmentRecord>(db.attachments, householdId, {
        ownerType: f.ownerType,
        ownerId: f.ownerId,
        kind: f.kind,
        mime: f.mime,
        name: f.name,
        size: f.blob.size,
        blob: f.blob,
      });
      ids.push(rec.id);
    }
    return ids;
  },

  async get(id: string): Promise<AttachmentRecord | undefined> {
    const rec = await db.attachments.get(id);
    return rec && !rec.deletedAt ? rec : undefined;
  },

  remove(id: string): Promise<void> {
    return archiveRecord(db.attachments, id);
  },
};
