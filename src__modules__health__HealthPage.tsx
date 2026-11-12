import { Link } from 'react-router-dom';
import { ErrorLine, Loading } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { listProfileOptions } from '@/core/services/healthService';
import { useLoader } from '@/hooks/useLoader';

export function HealthPage() {
  const { state } = useLoader(async () => {
    const p = await listProfileOptions();
    return p.length ? p : null;
  }, []);

  return (
    <>
      <PageHeader title="الصحة" subtitle="سجل كل فرد: زيارات، مستندات، روشتات، علاجات" />
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorLine message={state.message} />}
      {state.status === 'empty' && (
        <section className="card">
          <p>أضف أفراد الأسرة أولًا.</p>
          <Link to="/family">الذهاب إلى صفحة الأسرة</Link>
        </section>
      )}
      {state.status === 'ready' && (
        <ul className="plain-list item-list">
          {state.data.map((p) => (
            <li key={p.id}>
              <Link className="item-link" to={`/health/${p.id}`}>
                <strong>{p.name}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section className="card">
        <p>
          <Link to="/treatments">جرعات اليوم والعلاجات</Link>
        </p>
        <p>
          <Link to="/appointments">المواعيد والمهام</Link>
        </p>
      </section>
    </>
  );
}
