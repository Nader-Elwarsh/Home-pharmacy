import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import type { AuthUser, FamilyOverview } from '@/core/domain/householdTypes';
import { canEditProfiles, ROLE_LABELS } from '@/core/domain/roles';
import { signInWithGoogle, signOutUser } from '@/core/services/authService';
import {
  addFamilyProfile,
  createHousehold,
  toUserMessage,
} from '@/core/services/householdService';
import { useAuth } from '@/modules/auth/useAuth';
import { useFamily } from './useFamily';

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert">
      <StatusBadge kind="danger" label={message} />
    </p>
  );
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="signin-title">
      <h2 id="signin-title">تسجيل الدخول</h2>
      <p>سجّل الدخول بحساب Google لإنشاء منزلك وإضافة أفراد أسرتك.</p>
      <Button onClick={onClick} disabled={busy}>
        {busy ? 'جارٍ الدخول…' : 'الدخول بحساب Google'}
      </Button>
      <ErrorLine message={error} />
    </section>
  );
}

function CreateHousehold({ user, onDone }: { user: AuthUser; onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createHousehold(user, name);
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
      <p>المنزل هو مساحة بيانات أسرتك. اختر له اسمًا تتعرف عليه.</p>
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

function AddProfileForm({
  user,
  overview,
  onDone,
}: {
  user: AuthUser;
  overview: FamilyOverview;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addFamilyProfile({
        user,
        householdId: overview.household.id,
        role: overview.role,
        rawName: name,
        rawBirthDate: birthDate,
      });
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

function Household({ user, overview, reload }: { user: AuthUser; overview: FamilyOverview; reload: () => void }) {
  return (
    <>
      <section className="card" aria-labelledby="hh-title">
        <h2 id="hh-title">{overview.household.name}</h2>
        <p>دورك: {ROLE_LABELS[overview.role]}</p>
      </section>

      <section className="card" aria-labelledby="profiles-title">
        <h2 id="profiles-title">أفراد الأسرة</h2>
        {overview.profiles.length === 0 ? (
          <p className="muted">لم تُضف أي أفراد بعد.</p>
        ) : (
          <ul className="plain-list">
            {overview.profiles.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.birthDate && <span className="muted"> — وُلد {p.birthDate}</span>}
              </li>
            ))}
          </ul>
        )}
        {canEditProfiles(overview.role) ? (
          <AddProfileForm user={user} overview={overview} onDone={reload} />
        ) : (
          <p className="muted">دورك لا يسمح بإضافة أفراد.</p>
        )}
      </section>

      <section className="card" aria-labelledby="members-title">
        <h2 id="members-title">أعضاء المنزل</h2>
        <ul className="plain-list">
          {overview.members.map((m) => (
            <li key={m.uid}>
              {m.displayName || 'عضو'} <span className="muted">({ROLE_LABELS[m.role]})</span>
            </li>
          ))}
        </ul>
        <p className="muted">دعوة أفراد الأسرة بحساباتهم تُضاف في المرحلة P1-ب.</p>
      </section>
    </>
  );
}

function FamilyContent({ user }: { user: AuthUser }) {
  const { state, reload } = useFamily(user);

  if (state.status === 'loading') return <StatusBadge kind="info" label="جارٍ التحميل" />;
  if (state.status === 'error') {
    return (
      <section className="card">
        <ErrorLine message={state.message} />
        <Button variant="secondary" onClick={reload}>
          إعادة المحاولة
        </Button>
      </section>
    );
  }
  if (state.status === 'none') return <CreateHousehold user={user} onDone={reload} />;
  return <Household user={user} overview={state.overview} reload={reload} />;
}

export function FamilyPage() {
  const auth = useAuth();

  return (
    <>
      <PageHeader title="الأسرة" subtitle="المنزل وأفراد الأسرة" />
      {auth.loading ? (
        <StatusBadge kind="info" label="جارٍ التحميل" />
      ) : !auth.user ? (
        <SignIn />
      ) : (
        <>
          <p className="muted">
            الحساب: {auth.user.displayName ?? auth.user.email}{' '}
            <Button variant="secondary" onClick={() => void signOutUser()}>
              تسجيل الخروج
            </Button>
          </p>
          <FamilyContent user={auth.user} />
        </>
      )}
    </>
  );
}
