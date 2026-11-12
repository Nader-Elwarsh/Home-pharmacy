import { useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorLine, Loading, SelectField, TextAreaField, TextField } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { CONTACT_KINDS, CONTACT_LABELS, EMPTY_CONTACT, type ContactInput } from '@/core/domain/healthRules';
import { addContact, archiveContact, listContacts, setFavorite } from '@/core/services/directoryService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';

export function ContactsPage() {
  const { state, reload } = useLoader(async () => listContacts(), []);
  const [f, setF] = useState<ContactInput>(EMPTY_CONTACT);
  const { busy, error, run } = useSubmit();
  const set = (k: keyof ContactInput) => (v: string) => setF({ ...f, [k]: v });

  return (
    <>
      <PageHeader title="دليلي" subtitle="أطباء وعيادات وصيدليات ومعامل تتعامل معها. بياناتك أنت، ولا يوصي بها التطبيق." />
      <form className="form card" onSubmit={async (e) => { e.preventDefault(); if (await run(() => addContact(f))) { setF(EMPTY_CONTACT); reload(); } }}>
        <h2>إضافة جهة</h2>
        <SelectField label="النوع" value={f.kind} onChange={set('kind')} options={CONTACT_KINDS.map((k) => ({ value: k, label: CONTACT_LABELS[k] }))} />
        <TextField label="الاسم" value={f.name} onChange={set('name')} />
        {f.kind === 'doctor' && <TextField label="التخصص" value={f.specialty} onChange={set('specialty')} />}
        <TextField label="الهاتف" value={f.phone} onChange={set('phone')} inputMode="tel" />
        <TextField label="واتساب" value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" />
        <TextField label="العنوان" value={f.address} onChange={set('address')} />
        <TextField label="مواعيد العمل" value={f.hours} onChange={set('hours')} />
        {(f.kind === 'doctor' || f.kind === 'clinic') && <TextField label="سعر الكشف" value={f.fee} onChange={set('fee')} />}
        <TextField label="رابط الموقع على الخريطة" value={f.mapUrl} onChange={set('mapUrl')} inputMode="url" />
        {f.kind === 'pharmacy' && (
          <label className="check">
            <input type="checkbox" checked={f.delivery} onChange={(e) => setF({ ...f, delivery: e.target.checked })} />
            توصيل للمنازل
          </label>
        )}
        <TextAreaField label="ملاحظات" value={f.notes} onChange={set('notes')} maxLength={500} />
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy}>حفظ</Button>
      </form>

      {state.status === 'loading' && <Loading />}
      {state.status === 'ready' &&
        state.data.map((c) => (
          <section key={c.id} className="card">
            <h2>{c.favorite && '★ '}{c.name}</h2>
            <StatusBadge kind="info" label={c.kindLabel} />
            {c.delivery && <StatusBadge kind="ok" label="توصيل" />}
            <ul className="plain-list">
              {c.specialty && <li>{c.specialty}</li>}
              {c.address && <li>{c.address}</li>}
              {c.hours && <li>المواعيد: {c.hours}</li>}
              {c.fee && <li>الكشف: {c.fee}</li>}
              {c.notes && <li>{c.notes}</li>}
            </ul>
            <div className="chips">
              {c.phone && <a className="btn btn-secondary btn-link" href={`tel:${c.phone.replace(/\s/g, '')}`}>اتصال</a>}
              {c.whatsappUrl && <a className="btn btn-secondary btn-link" href={c.whatsappUrl} target="_blank" rel="noreferrer">واتساب</a>}
              {c.mapUrl && <a className="btn btn-secondary btn-link" href={c.mapUrl} target="_blank" rel="noreferrer">الخريطة</a>}
              <Button variant="secondary" onClick={async () => { await setFavorite(c.id, !c.favorite); reload(); }}>{c.favorite ? 'إزالة من المفضلة' : 'مفضلة'}</Button>
              <Button variant="secondary" onClick={async () => { if (window.confirm('حذف الجهة؟')) { await archiveContact(c.id); reload(); } }}>حذف</Button>
            </div>
          </section>
        ))}
    </>
  );
}
