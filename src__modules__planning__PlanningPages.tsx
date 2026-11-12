import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ErrorLine, Loading, SelectField, TextField } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import {
  APPT_KINDS,
  APPT_LABELS,
  EMPTY_APPT,
  EMPTY_SHOPPING,
  EMPTY_TASK,
  PRIORITIES,
  PRIORITY_LABELS,
  type ApptInput,
  type ShoppingInput,
  type TaskInput,
} from '@/core/domain/healthRules';
import { listProfileOptions, loadLinkOptions } from '@/core/services/healthService';
import {
  addAppointment,
  addShopping,
  addTask,
  archiveAppointment,
  archiveShopping,
  archiveTask,
  listAppointments,
  listShopping,
  listTasks,
  setAppointmentStatus,
  setShoppingBought,
  setTaskDone,
} from '@/core/services/planningService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';

function ApptForm({ onDone }: { onDone: () => void }) {
  const { state } = useLoader(async () => ({ p: await listProfileOptions(), l: await loadLinkOptions() }), []);
  const [f, setF] = useState<ApptInput>(EMPTY_APPT);
  const { busy, error, run } = useSubmit();
  const set = (k: keyof ApptInput) => (v: string) => setF({ ...f, [k]: v });
  if (state.status !== 'ready') return <Loading />;
  return (
    <form className="form card" onSubmit={async (e) => { e.preventDefault(); if (await run(() => addAppointment(f))) { setF(EMPTY_APPT); onDone(); } }}>
      <h2>إضافة موعد</h2>
      <SelectField label="الفرد" value={f.profileId} onChange={set('profileId')} emptyLabel="اختر" options={state.data.p.map((x) => ({ value: x.id, label: x.name }))} />
      <SelectField label="النوع" value={f.kind} onChange={set('kind')} options={APPT_KINDS.map((k) => ({ value: k, label: APPT_LABELS[k] }))} />
      <TextField label="العنوان" value={f.title} onChange={set('title')} />
      <TextField label="التاريخ" type="date" value={f.date} onChange={set('date')} />
      <TextField label="الوقت (اختياري)" value={f.time} onChange={set('time')} placeholder="مثال: 17:30" />
      <SelectField label="الطبيب أو الجهة (اختياري)" value={f.contactId} onChange={set('contactId')} emptyLabel="بدون" options={state.data.l.contacts.map((c) => ({ value: c.id, label: c.label }))} />
      <ErrorLine message={error} />
      <Button type="submit" disabled={busy}>حفظ الموعد</Button>
    </form>
  );
}

function TaskForm({ onDone }: { onDone: () => void }) {
  const { state } = useLoader(async () => ({ p: await listProfileOptions() }), []);
  const [f, setF] = useState<TaskInput>(EMPTY_TASK);
  const { busy, error, run } = useSubmit();
  const set = (k: keyof TaskInput) => (v: string) => setF({ ...f, [k]: v });
  if (state.status !== 'ready') return <Loading />;
  return (
    <form className="form card" onSubmit={async (e) => { e.preventDefault(); if (await run(() => addTask(f))) { setF(EMPTY_TASK); onDone(); } }}>
      <h2>إضافة مهمة</h2>
      <TextField label="المهمة (مثل: شراء أدوية الشهر)" value={f.title} onChange={set('title')} />
      <SelectField label="لـ (اختياري)" value={f.profileId} onChange={set('profileId')} emptyLabel="الجميع" options={state.data.p.map((x) => ({ value: x.id, label: x.name }))} />
      <TextField label="تاريخ الاستحقاق (اختياري)" type="date" value={f.dueDate} onChange={set('dueDate')} />
      <ErrorLine message={error} />
      <Button type="submit" disabled={busy}>حفظ المهمة</Button>
    </form>
  );
}

export function AppointmentsPage() {
  const appts = useLoader(async () => listAppointments(), []);
  const tasks = useLoader(async () => listTasks(), []);
  return (
    <>
      <PageHeader title="المواعيد والمهام" />
      <p><Link to="/health">← الصحة</Link></p>
      <ApptForm onDone={appts.reload} />
      <section className="card">
        <h2>المواعيد</h2>
        {appts.state.status === 'ready' && appts.state.data.length === 0 && <p className="muted">لا توجد مواعيد.</p>}
        {appts.state.status === 'ready' && (
          <ul className="plain-list">
            {appts.state.data.map((a) => (
              <li key={a.id}>
                <strong>{a.date}{a.time && ` ${a.time}`}</strong> — {a.title} <span className="muted">({a.kindLabel} — {a.profileName})</span>{' '}
                {a.status !== 'upcoming' && <StatusBadge kind="info" label={a.status === 'done' ? 'تم' : 'ملغي'} />}
                <div className="chips">
                  {a.status === 'upcoming' && <Button variant="secondary" onClick={async () => { await setAppointmentStatus(a.id, 'done'); appts.reload(); }}>تم</Button>}
                  {a.status === 'upcoming' && <Button variant="secondary" onClick={async () => { await setAppointmentStatus(a.id, 'cancelled'); appts.reload(); }}>إلغاء</Button>}
                  <Button variant="secondary" onClick={async () => { if (window.confirm('حذف الموعد؟')) { await archiveAppointment(a.id); appts.reload(); } }}>حذف</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <TaskForm onDone={tasks.reload} />
      <section className="card">
        <h2>المهام</h2>
        {tasks.state.status === 'ready' && tasks.state.data.length === 0 && <p className="muted">لا توجد مهام.</p>}
        {tasks.state.status === 'ready' && (
          <ul className="plain-list">
            {tasks.state.data.map((t) => (
              <li key={t.id}>
                <label className="check">
                  <input type="checkbox" checked={t.done} onChange={async (e) => { await setTaskDone(t.id, e.target.checked); tasks.reload(); }} />
                  <span style={t.done ? { textDecoration: 'line-through' } : undefined}>{t.title}</span>
                </label>
                <span className="muted">{t.profileName && ` ${t.profileName}`}{t.dueDate && ` — حتى ${t.dueDate}`}</span>{' '}
                <button type="button" className="btn-link" onClick={async () => { await archiveTask(t.id); tasks.reload(); }}>حذف</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function ShoppingPage() {
  const list = useLoader(async () => listShopping(), []);
  const { state } = useLoader(async () => ({ p: await listProfileOptions() }), []);
  const [f, setF] = useState<ShoppingInput>(EMPTY_SHOPPING);
  const { busy, error, run } = useSubmit();
  const set = (k: keyof ShoppingInput) => (v: string) => setF({ ...f, [k]: v });
  return (
    <>
      <PageHeader title="قائمة المشتريات" subtitle="ما تحتاج شراءه. لا يتم أي شراء من التطبيق." />
      <form className="form card" onSubmit={async (e) => { e.preventDefault(); if (await run(() => addShopping(f))) { setF(EMPTY_SHOPPING); list.reload(); } }}>
        <TextField label="اسم الصنف" value={f.name} onChange={set('name')} />
        <TextField label="الكمية (اختياري)" value={f.qty} onChange={set('qty')} />
        <SelectField label="لـ (اختياري)" value={f.profileId} onChange={set('profileId')} emptyLabel="للمنزل" options={(state.status === 'ready' ? state.data.p : []).map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField label="الأولوية" value={f.priority} onChange={set('priority')} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy}>إضافة</Button>
      </form>
      <section className="card">
        {list.state.status === 'ready' && list.state.data.length === 0 && <p className="muted">القائمة فارغة.</p>}
        {list.state.status === 'ready' && (
          <ul className="plain-list">
            {list.state.data.map((s) => (
              <li key={s.id}>
                <label className="check">
                  <input type="checkbox" checked={s.bought} onChange={async (e) => { await setShoppingBought(s.id, e.target.checked); list.reload(); }} />
                  <span style={s.bought ? { textDecoration: 'line-through' } : undefined}>{s.name}{s.qty && ` × ${s.qty}`}</span>
                </label>{' '}
                {s.priority === 'high' && <StatusBadge kind="warning" label={s.priorityLabel} />}
                <span className="muted">{s.profileName && ` ${s.profileName}`}{s.reason && ` — ${s.reason}`}</span>{' '}
                <button type="button" className="btn-link" onClick={async () => { await archiveShopping(s.id); list.reload(); }}>حذف</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
