import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import {
  addLocalProfile,
  createLocalHousehold,
  toUserMessage,
  type LocalFamily,
} from '@/core/services/familyService';
import { useFamily } from './useFamily';

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert">
      <StatusBadge kind="danger" label={message} />
    </p>
  );
}

function CreateHousehold({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createLocalHousehold(name);
      onDone();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="create-title">
      <h2 id="create-title">إنشاء منزل</h2>
      <p>المنزل هو مساحة بيانات أسرتك على هذا الجهاز. اختر له اسمًا تتعرف عليه.</p>
      <form onSubmit={onSubmit} className="form">
        <label>
          اسم المنزل
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء المنزل'}
        </Button>
      </form>
      <ErrorLine message={error} />
    </section>
  );
}

function AddProfileForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addLocalProfile(name, birthDate);
      setName('');
      setBirthDate('');
      onDone();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        الاسم
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>
      <label>
        تاريخ الميلاد (اختياري)
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? 'جارٍ الإضافة…' : 'إضافة فرد'}
      </Button>
      <ErrorLine message={error} />
    </form>
  );
}

function Household({ family, reload }: { family: LocalFamily; reload: () => void }) {
  return (
    <>
      <section className="card" aria-labelledby="hh-title">
        <h2 id="hh-title">{family.household.name}</h2>
        <StatusBadge kind="info" label="محفوظ على هذا الجهاز فقط" />
        <p className="muted">
          لا توجد نسخة احتياطية ولا مزامنة بعد. مسح بيانات المتصفح يحذف هذه البيانات.
        </p>
      </section>

      <section className="card" aria-labelledby="profiles-title">
        <h2 id="profiles-title">أفراد الأسرة</h2>
        {family.profiles.length === 0 ? (
          <p className="muted">لم تُضف أي أفراد بعد.</p>
        ) : (
          <ul className="plain-list">
            {family.profiles.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.birthDate && <span className="muted"> — وُلد {p.birthDate}</span>}
              </li>
            ))}
          </ul>
        )}
        <AddProfileForm onDone={reload} />
      </section>
    </>
  );
}

export function FamilyPage() {
  const { state, reload } = useFamily();

  return (
    <>
      <PageHeader title="الأسرة" subtitle="المنزل وأفراد الأسرة" />
      {state.status === 'loading' && <StatusBadge kind="info" label="جارٍ التحميل" />}
      {state.status === 'error' && (
        <section className="card">
          <ErrorLine message={state.message} />
          <Button variant="secondary" onClick={reload}>
            إعادة المحاولة
          </Button>
        </section>
      )}
      {state.status === 'none' && <CreateHousehold onDone={reload} />}
      {state.status === 'ready' && <Household family={state.family} reload={reload} />}
    </>
  );
}
