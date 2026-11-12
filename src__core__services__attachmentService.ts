import type { AttachmentOwnerType } from '../database/db';
import { UserInputError } from '../domain/errors';
import { MAX_FILES_PER_RECORD, validateFile } from '../domain/healthRules';
import { attachmentRepository, type NewAttachment } from '../repositories/attachmentRepository';
import { compressImage } from '../../utils/imageCompress';
import { requireHousehold } from './common';

export interface AttachmentView {
  id: string;
  name: string;
  mime: string;
  kind: 'image' | 'pdf';
  blob: Blob;
}

/** رسالة الخطأ الأولى إن وُجدت، وإلا null. */
export function checkFiles(files: ReadonlyArray<File>): string | null {
  if (files.length > MAX_FILES_PER_RECORD) return `الحد الأقصى ${MAX_FILES_PER_RECORD} ملفات`;
  for (const f of files) {
    const r = validateFile(f);
    if (!r.ok) return r.error;
  }
  return null;
}

/** يتحقق من الملفات، يضغط الصور، ويحفظها. يعيد المعرّفات بترتيب الملفات. */
export async function saveFiles(
  files: ReadonlyArray<File>,
  ownerType: AttachmentOwnerType,
  ownerId: string,
): Promise<string[]> {
  if (files.length === 0) return [];
  const problem = checkFiles(files);
  if (problem) throw new UserInputError(problem);

  const household = await requireHousehold();
  const prepared: NewAttachment[] = [];
  for (const f of files) {
    const kind = f.type === 'application/pdf' ? 'pdf' : 'image';
    const blob = kind === 'image' ? await compressImage(f) : f;
    prepared.push({
      ownerType,
      ownerId,
      kind,
      mime: kind === 'image' ? blob.type || f.type : 'application/pdf',
      name: f.name,
      blob,
    });
  }
  return attachmentRepository.addMany(household.id, prepared);
}

export async function loadAttachment(id: string): Promise<AttachmentView | null> {
  const rec = await attachmentRepository.get(id);
  if (!rec) return null;
  return { id: rec.id, name: rec.name, mime: rec.mime, kind: rec.kind, blob: rec.blob };
}

export function removeAttachment(id: string): Promise<void> {
  return attachmentRepository.remove(id);
}
