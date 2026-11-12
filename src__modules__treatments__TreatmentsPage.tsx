import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ErrorLine, Loading, SelectField, TextAreaField, TextField } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge, type StatusKind } from '@/components/StatusBadge';
import {
  EMPTY_TREATMENT,
  EMPTY_TX_ITEM,
  TREATMENT_LABELS,
  TREATMENT_STATUSES,
  type TreatmentInput,
  type TreatmentStatus,
} from '@/core/domain/healthRules';
import { DOSE_STATUS_LABELS, type DoseState, type DoseStatus } from '@/core/domain/schedule';
import { listProfileOptions, loadLinkOptions } from '@/core/services/healthService';
import {
  addTreatment,
  archiveTreatment,
  listTreatments,
  loadDoses,
  setDose,
  setTreatmentStatus,
  type DoseRow,
} from '@/core/services/treatmentService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';

const DOSE_KIND: Record<DoseState, StatusKind> = {
  taken: 'ok',
  missed: 'danger',
  skipped: 'info',
  postponed: 'warning',
  overdue: 'warning',
  pending: 'info',
};

function DoseItem({ d, onDone }: { d: DoseRow; onDone: () => void }) {
  const { error, run } = useSubmit();
  const mark = async (s: DoseStatus) => {
    let reason: string | undefined;
    if (s === 'skipped' || s === 'postponed') reason = window.prompt('السبب (اختياري)') ?? undefined;
    if (await run(() => setDose(d, s, reason))) onDone();
  };
  return (
    <li>
      <strong>{d.time}</strong> — {d.name} <span className="muted">({d.profileName})</span>{' '}
      <StatusBadge kind={DOSE_KIND[d.state]} label={DOSE_STATUS_LABELS[d.state]} />
      <div className="chips">
        <Button variant="secondary" onClick={() => void mark('taken')}>تم</Button>
        <Button variant="secondary" onClick={() => void mark('skipped')}>تخطي</Button>
        <Button variant="secondary" onClick={() => void mark('postponed')}>تأجيل</Button>
        <Button variant="secondary" onClick={() => void mark('missed')}>لم تؤخذ</Button>
      </div>
      <ErrorLine message={error} />
    </li>
  );
}

function NewTreatment({ onDone }: { onDone: () => void }) {
  const [params] = useSearchParams();
  const base: TreatmentInput = { ...EMPTY_TREATMENT, profileId: params.get('profile') ?? '', items: [{ ...EMPTY_TX_ITEM }] };
  const { state } = useLoader(async () => ({ profiles: await listProfileOptions(), links: await loadLinkOptions() }), []);
  const [form, setForm] = useState<TreatmentInput>(base);
  const { busy, error, run } = useSubmit();
  const set = (k: keyof TreatmentInput) => (v: string) => setForm({ ...form, [k]: v });
  const setItem = (i: number, k: keyof TreatmentInput['items'][number], v: string) =>
    setForm({ ...form, items: form.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });
  if (state.status !== 'ready') return <Loading />;
  const { profiles, links } = state.data;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => addTreatment(form))) {
      setForm(base);
      onDone();
    }
  }

  return (
    <form className="form card" onSubmit={submit}>
      <h2>إضافة علاج</h2>
      <p className="muted">أدخل ما وصفه الطبيب كما هو. التطبيق لا يقترح جرعات ولا أوقاتًا، ومواعيد التذكير من إدخالك فقط.</p>
      <SelectField label="الفرد" value={form.profileId} onChange={set('profileId')} emptyLabel="اختر" options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
      <TextField label="اسم العلاج (مثل: علاج التهاب الحلق)" value={form.name} onChange={set('name')} />
      <TextField label="تاريخ البداية" type="date" value={form.startDate} onChange={set('startDate')} />
      <TextField label="تاريخ النهاية (اختياري)" type="date" value={form.endDate} onChange={set('endDate')} />
      <SelectField label="مرتبط بروشتة (اختياري)" value={form.prescriptionId} onChange={set('prescriptionId')} emptyLabel="بدون" options={links.prescriptions.map((p) => ({ value: p.id, label: p.label }))} />
      {form.items.map((it, i) => (
        <div key={i} className="form card">
          <TextField label="اسم الدواء" value={it.name} onChange={(v) => setItem(i, 'name', v)} />
          <SelectField label="الدواء في الخزانة (اختياري)" value={it.itemId} onChange={(v) => setItem(i, 'itemId', v)} emptyLabel="غير مربوط" options={links.items.map((x) => ({ value: x.id, label: x.label }))} />
          <TextField label="تعليمات الطبيب كما كُتبت (اختياري)" value={it.instructions} onChange={(v) => setItem(i, 'instructions', v)} />
          <TextField label="مواعيد التذكير (اختياري)" value={it.times} onChange={(v) => setItem(i, 'times', v)} placeholder="مثال: 08:00، 20:00" hint="اكتب الأوقات التي حددها الطبيب لك." />
          {form.items.length > 1 && (
            <button type="button" className="btn-link" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>إزالة</button>
          )}
        </div>
      ))}
      <Button variant="secondary" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_TX_ITEM }] })}>+ دواء آخر</Button>
      <TextAreaField label="ملاحظات" value={form.notes} onChange={set('notes')} />
      <ErrorLine message={error} />
      <Button type="submit" disabled={busy}>حفظ العلاج</Button>
    </form>
  );
}

export function TreatmentsPage() {
  const [params] = useSearchParams();
  const profileId = params.get('profile') ?? undefined;
  const doses = useLoader(async () => loadDoses(), []);
  const list = useLoader(async () => {
    const r = await listTreatments(profileId);
    return r;
  }, [profileId]);
  const reloadAll = () => { doses.reload(); list.reload(); };

  return (
    <>
      <PageHeader title="العلاجات" subtitle="جرعات اليوم كما سجلتها أنت. لا علاقة لها بكميات الخزانة." />
      <p><Link to="/health">← الصحة</Link></p>

      <section className="card">
        <h2>جرعات اليوم</h2>
        {doses.state.status === 'loading' && <Loading />}
        {doses.state.status === 'error' && <ErrorLine message={doses.state.message} />}
        {doses.state.status === 'ready' && doses.state.data.length === 0 && <p className="muted">لا توجد جرعات اليوم.</p>}
        {doses.state.status === 'ready' && (
          <ul className="plain-list">
            {doses.state.data.map((d) => <DoseItem key={d.slotKey} d={d} onDone={reloadAll} />)}
          </ul>
        )}
        <p className="muted">الجرعة الفائتة لا تُعوَّض ولا تُضاعف. استشر الطبيب أو الصيدلي عند الشك.</p>
      </section>

      <NewTreatment onDone={reloadAll} />

      {list.state.status === 'ready' &&
        list.state.data.map((t) => (
          <section key={t.id} className="card">
            <h2>{t.name}</h2>
            <div className="muted">{t.profileName} — من {t.startDate}{t.endDate && ` إلى ${t.endDate}`}</div>
            <StatusBadge kind={t.status === 'active' ? 'ok' : 'info'} label={t.statusLabel} />
            <ul className="plain-list">
              {t.items.map((i) => (
                <li key={i.id}>
                  {i.name} {i.times.length > 0 && <span className="muted">— {i.times.join('، ')}</span>}
                  {i.instructions && <div className="muted">{i.instructions}</div>}
                </li>
              ))}
            </ul>
            <select aria-label="حالة العلاج" value={t.status} onChange={async (e) => { await setTreatmentStatus(t.id, e.target.value as TreatmentStatus); reloadAll(); }}>
              {TREATMENT_STATUSES.map((s) => <option key={s} value={s}>{TREATMENT_LABELS[s]}</option>)}
            </select>{' '}
            <button type="button" className="btn-link" onClick={async () => { if (window.confirm('حذف العلاج؟ سجل الجرعات يبقى محفوظًا.')) { await archiveTreatment(t.id); reloadAll(); } }}>حذف</button>
          </section>
        ))}
    </>
  );
}
