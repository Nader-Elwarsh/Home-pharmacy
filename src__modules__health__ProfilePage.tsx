import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AttachmentList } from '@/components/AttachmentView';
import { Button } from '@/components/Button';
import { ErrorLine, Loading, SelectField, TextAreaField, TextField } from '@/components/Fields';
import { FilePicker } from '@/components/FilePicker';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import {
  DISPENSE_STATUSES,
  DISPENSE_LABELS,
  DOC_KINDS,
  DOC_LABELS,
  EMPTY_DOC,
  EMPTY_RX,
  EMPTY_RX_ITEM,
  EMPTY_VISIT,
  type DispenseStatus,
  type DocInput,
  type RxInput,
  type VisitInput,
} from '@/core/domain/healthRules';
import { TIMELINE_LABELS, type TimelineEvent } from '@/core/domain/timeline';
import {
  addDocument,
  addPrescription,
  addVisit,
  archiveDocument,
  archivePrescription,
  archiveVisit,
  listPrescriptions,
  loadLinkOptions,
  loadProfileOverview,
  searchDocuments,
  setDispenseStatus,
} from '@/core/services/healthService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';

type Tab = 'timeline' | 'visits' | 'docs' | 'rx';
const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: 'الخط الزمني' },
  { id: 'visits', label: 'الزيارات' },
  { id: 'docs', label: 'المستندات' },
  { id: 'rx', label: 'الروشتات' },
];

function EventList({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="muted">لا يوجد.</p>;
  return (
    <ul className="plain-list">
      {events.map((e) => (
        <li key={e.id}>
          <strong>{e.date}</strong> — {TIMELINE_LABELS[e.kind]}: {e.title}
          {e.subtitle && <span className="muted"> ({e.subtitle})</span>}
        </li>
      ))}
    </ul>
  );
}

function VisitsTab({ profileId }: { profileId: string }) {
  const { state, reload } = useLoader(() => loadProfileOverview(profileId), [profileId]);
  const links = useLoader(async () => loadLinkOptions(), []);
  const [form, setForm] = useState<VisitInput>({ ...EMPTY_VISIT, profileId });
  const { busy, error, run } = useSubmit();
  const set = (k: keyof VisitInput) => (v: string) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => addVisit(form))) {
      setForm({ ...EMPTY_VISIT, profileId });
      reload();
    }
  }

  return (
    <>
      <form className="form card" onSubmit={submit}>
        <h2>تسجيل زيارة</h2>
        <TextField label="التاريخ" type="date" value={form.date} onChange={set('date')} />
        <SelectField
          label="الطبيب أو الجهة (اختياري)"
          value={form.contactId}
          onChange={set('contactId')}
          emptyLabel="بدون"
          options={(links.state.status === 'ready' ? links.state.data.contacts : []).map((c) => ({ value: c.id, label: c.label }))}
        />
        <TextField label="سبب الزيارة (اختياري)" value={form.reason} onChange={set('reason')} maxLength={200} />
        <TextAreaField label="ملاحظات" value={form.notes} onChange={set('notes')} />
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy}>حفظ الزيارة</Button>
      </form>
      {state.status === 'ready' && (
        <ul className="plain-list">
          {state.data.visits.map((v) => (
            <li key={v.id} className="card">
              <strong>{v.date}</strong> {v.reason}
              {v.contactName && <div className="muted">{v.contactName}</div>}
              {v.notes && <div>{v.notes}</div>}
              <button type="button" className="btn-link" onClick={async () => { if (window.confirm('أرشفة الزيارة؟')) { await archiveVisit(v.id); reload(); } }}>أرشفة</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DocsTab({ profileId }: { profileId: string }) {
  const [query, setQuery] = useState('');
  const { state, reload } = useLoader(async () => {
    const r = await searchDocuments(profileId, query);
    return r;
  }, [profileId, query]);
  const links = useLoader(async () => loadLinkOptions(), []);
  const [form, setForm] = useState<DocInput>({ ...EMPTY_DOC, profileId });
  const [files, setFiles] = useState<File[]>([]);
  const { busy, error, setError, run } = useSubmit();
  const set = (k: keyof DocInput) => (v: string) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => addDocument(form, files))) {
      setForm({ ...EMPTY_DOC, profileId });
      setFiles([]);
      reload();
    }
  }

  return (
    <>
      <form className="form card" onSubmit={submit}>
        <h2>إضافة مستند</h2>
        <SelectField label="النوع" value={form.kind} onChange={set('kind')} options={DOC_KINDS.map((k) => ({ value: k, label: DOC_LABELS[k] }))} />
        <TextField label="اسم المستند" value={form.title} onChange={set('title')} maxLength={120} />
        <TextField label="التاريخ" type="date" value={form.date} onChange={set('date')} />
        <TextField label="المعمل أو المستشفى (اختياري)" value={form.facility} onChange={set('facility')} />
        <SelectField
          label="مرتبط بزيارة (اختياري)"
          value={form.visitId}
          onChange={set('visitId')}
          emptyLabel="بدون"
          options={(links.state.status === 'ready' ? links.state.data.visits : []).map((v) => ({ value: v.id, label: v.label }))}
        />
        <TextField label="كلمات مفتاحية (اختياري)" value={form.tags} onChange={set('tags')} />
        <TextAreaField label="ملاحظات" value={form.notes} onChange={set('notes')} />
        <FilePicker files={files} onChange={setFiles} camera onProblem={setError} />
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ المستند'}</Button>
      </form>

      <div className="form">
        <TextField label="بحث في المستندات" value={query} onChange={setQuery} />
      </div>
      {state.status === 'loading' && <Loading />}
      {state.status === 'empty' && <p className="muted">لا توجد مستندات.</p>}
      {state.status === 'ready' && state.data.length === 0 && <p className="muted">لا توجد مستندات مطابقة.</p>}
      {state.status === 'ready' &&
        state.data.map((d) => (
          <section key={d.id} className="card">
            <strong>{d.title}</strong> <StatusBadge kind="info" label={d.kindLabel} />
            <div className="muted">{d.date}{d.facility && ` — ${d.facility}`}</div>
            {d.notes && <div>{d.notes}</div>}
            <AttachmentList ids={d.attachmentIds} />
            <button type="button" className="btn-link" onClick={async () => { if (window.confirm('حذف المستند وملفاته؟')) { await archiveDocument(d.id, d.attachmentIds); reload(); } }}>حذف</button>
          </section>
        ))}
    </>
  );
}

function RxTab({ profileId }: { profileId: string }) {
  const { state, reload } = useLoader(async () => {
    const r = await listPrescriptions(profileId);
    return r;
  }, [profileId]);
  const links = useLoader(async () => loadLinkOptions(), []);
  const [form, setForm] = useState<RxInput>({ ...EMPTY_RX, profileId, items: [{ ...EMPTY_RX_ITEM }] });
  const [files, setFiles] = useState<File[]>([]);
  const { busy, error, setError, run } = useSubmit();
  const set = (k: keyof RxInput) => (v: string) => setForm({ ...form, [k]: v });
  const setItem = (i: number, k: keyof RxInput['items'][number], v: string) =>
    setForm({ ...form, items: form.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });
  const itemOptions = (links.state.status === 'ready' ? links.state.data.items : []).map((x) => ({ value: x.id, label: x.label }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => addPrescription(form, files))) {
      setForm({ ...EMPTY_RX, profileId, items: [{ ...EMPTY_RX_ITEM }] });
      setFiles([]);
      reload();
    }
  }

  return (
    <>
      <form className="form card" onSubmit={submit}>
        <h2>تسجيل روشتة</h2>
        <TextField label="تاريخ الروشتة" type="date" value={form.date} onChange={set('date')} />
        <SelectField
          label="الطبيب (اختياري)"
          value={form.contactId}
          onChange={set('contactId')}
          emptyLabel="بدون"
          options={(links.state.status === 'ready' ? links.state.data.contacts : []).map((c) => ({ value: c.id, label: c.label }))}
        />
        <TextField label="السبب (اختياري)" value={form.reason} onChange={set('reason')} />
        <h3>الأدوية المكتوبة</h3>
        <p className="muted">انقل ما كتبه الطبيب كما هو. التطبيق لا يقترح أدوية ولا جرعات.</p>
        {form.items.map((it, i) => (
          <div key={i} className="form card">
            <TextField label="اسم الدواء كما كُتب" value={it.writtenName} onChange={(v) => setItem(i, 'writtenName', v)} />
            <TextField label="تعليمات الطبيب كما كُتبت (اختياري)" value={it.instructions} onChange={(v) => setItem(i, 'instructions', v)} />
            <TextField label="المدة (اختياري)" value={it.duration} onChange={(v) => setItem(i, 'duration', v)} />
            <SelectField label="ربط بدواء في الخزانة (اختياري)" value={it.itemId} onChange={(v) => setItem(i, 'itemId', v)} emptyLabel="غير مربوط" options={itemOptions} />
            <SelectField
              label="حالة الصرف"
              value={it.dispenseStatus}
              onChange={(v) => setItem(i, 'dispenseStatus', v)}
              options={DISPENSE_STATUSES.map((s) => ({ value: s, label: DISPENSE_LABELS[s] }))}
            />
            {form.items.length > 1 && (
              <button type="button" className="btn-link" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}>إزالة هذا الدواء</button>
            )}
          </div>
        ))}
        <Button variant="secondary" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_RX_ITEM }] })}>+ دواء آخر</Button>
        <h3>صورة الروشتة</h3>
        <FilePicker files={files} onChange={setFiles} camera onProblem={setError} />
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الروشتة'}</Button>
      </form>

      {state.status === 'ready' &&
        state.data.map((r) => (
          <section key={r.id} className="card">
            <strong>{r.date}</strong> {r.reason}
            {r.contactName && <div className="muted">{r.contactName}</div>}
            <AttachmentList ids={r.attachmentIds} />
            <ul className="plain-list">
              {r.items.map((i) => (
                <li key={i.id}>
                  <strong>{i.writtenName}</strong> {i.instructions && <span>— {i.instructions}</span>}
                  <div className="muted">
                    {i.availabilityLabel}
                    {i.linkedItemId && <> — <Link to={`/cabinet/${i.linkedItemId}`}>عرض في الخزانة</Link></>}
                  </div>
                  <select
                    aria-label="حالة الصرف"
                    value={i.dispenseStatus}
                    onChange={async (e) => { await setDispenseStatus(i.id, e.target.value as DispenseStatus); reload(); }}
                  >
                    {DISPENSE_STATUSES.map((s) => <option key={s} value={s}>{DISPENSE_LABELS[s]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-link" onClick={async () => { if (window.confirm('حذف الروشتة؟')) { await archivePrescription(r.id, r.attachmentIds); reload(); } }}>حذف الروشتة</button>
          </section>
        ))}
    </>
  );
}

export function ProfilePage() {
  const { profileId = '' } = useParams();
  const [tab, setTab] = useState<Tab>('timeline');
  const { state } = useLoader(() => loadProfileOverview(profileId), [profileId, tab]);

  return (
    <>
      <PageHeader title={state.status === 'ready' ? state.data.name : 'ملف الفرد'} />
      <p>
        <Link to="/health">← الصحة</Link>
      </p>
      <div className="tabs" role="group" aria-label="أقسام الملف">
        {TABS.map((t) => (
          <Button key={t.id} variant={tab === t.id ? 'primary' : 'secondary'} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
        <Link className="btn btn-secondary btn-link" to={`/treatments?profile=${profileId}`}>العلاجات</Link>
      </div>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorLine message={state.message} />}
      {state.status === 'empty' && <p>الفرد غير موجود.</p>}
      {state.status === 'ready' && tab === 'timeline' && (
        <>
          <section className="card"><h2>القادم</h2><EventList events={state.data.timeline.upcoming} /></section>
          <section className="card"><h2>السابق</h2><EventList events={state.data.timeline.past} /></section>
        </>
      )}
      {state.status === 'ready' && tab === 'visits' && <VisitsTab profileId={profileId} />}
      {state.status === 'ready' && tab === 'docs' && <DocsTab profileId={profileId} />}
      {state.status === 'ready' && tab === 'rx' && <RxTab profileId={profileId} />}
    </>
  );
}
