import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorLine, Loading } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { BACKUP_TABLE_LABELS, BACKUP_TABLES } from '@/core/domain/backupFormat';
import { exportBackup, lastBackupAt, previewBackup, restoreBackup, type RestorePreview } from '@/core/services/backupService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';

export function BackupPage() {
  const last = useLoader(async () => ({ at: (await lastBackupAt()) ?? null }), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();

  async function onExport() {
    setDone(null);
    const ok = await run(async () => {
      const { filename, blob } = await exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    if (ok) { setDone('تم حفظ النسخة الاحتياطية. احتفظ بها في مكان آمن خارج هذا الجهاز.'); last.reload(); }
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setDone(null);
    setPreview(null);
    await run(async () => setPreview(await previewBackup(file)));
  }

  async function onRestore() {
    if (!preview) return;
    const ok = await run(async () => {
      const r = await restoreBackup(preview);
      setDone(`تمت الاستعادة: أُضيف ${r.added} سجلًا، وتُخطي ${r.skipped} موجودًا مسبقًا. لم يُحذف أو يُستبدل أي شيء.`);
    });
    if (ok) setPreview(null);
  }

  return (
    <>
      <PageHeader title="النسخ الاحتياطي" subtitle="بياناتك على هذا الجهاز فقط. النسخة تحميها من الضياع." />
      <section className="card">
        <h2>حفظ نسخة</h2>
        {last.state.status === 'loading' && <Loading />}
        {last.state.status === 'ready' && (
          <p>{last.state.data.at ? `آخر نسخة: ${new Date(last.state.data.at).toLocaleString('ar-EG')}` : 'لم تحفظ نسخة بعد.'}</p>
        )}
        <Button disabled={busy} onClick={() => void onExport()}>حفظ نسخة احتياطية</Button>
        <p className="muted">الملف يحتوي كل بياناتك وصورك بدون تشفير. لا تشاركه مع أحد.</p>
      </section>

      <section className="card">
        <h2>استعادة نسخة</h2>
        <p className="muted">الاستعادة تضيف الناقص فقط ولا تحذف ولا تستبدل أي بيانات موجودة.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = ''; }} />
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>اختيار ملف النسخة</Button>
        {preview && (
          <div>
            <h3>محتوى النسخة ({new Date(preview.exportedAt).toLocaleDateString('ar-EG')})</h3>
            <ul className="plain-list">
              {BACKUP_TABLES.filter((t) => preview.plan.counts[t] > 0 && t !== 'households').map((t) => (
                <li key={t}>{BACKUP_TABLE_LABELS[t]}: {preview.plan.counts[t]}</li>
              ))}
              <li>المرفقات: {preview.plan.attachmentCount}</li>
            </ul>
            <p>{preview.plan.mode === 'fresh' ? 'ستُستعاد كاملة على هذا الجهاز.' : 'ستُدمج مع بيانات هذا الجهاز.'}</p>
            <Button disabled={busy} onClick={() => void onRestore()}>استعادة الآن</Button>
          </div>
        )}
      </section>
      <ErrorLine message={error} />
      {done && <StatusBadge kind="ok" label={done} />}
    </>
  );
}
