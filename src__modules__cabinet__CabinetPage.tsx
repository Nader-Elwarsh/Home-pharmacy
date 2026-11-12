import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { matchesQuery, type ItemRow } from '@/core/services/inventoryService';
import { AttachmentThumb } from '@/components/AttachmentView';
import { useCabinet } from './useCabinet';
import { ITEM_STATUS } from './statusLabels';

type Filter = 'all' | 'expiring_soon' | 'expired' | 'empty' | 'low';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'expiring_soon', label: 'قريب الانتهاء' },
  { id: 'expired', label: 'منتهي' },
  { id: 'empty', label: 'نفد' },
  { id: 'low', label: 'كمية قليلة' },
];

function ItemCard({ item }: { item: ItemRow }) {
  const status = ITEM_STATUS[item.status];
  return (
    <li>
      <Link className="item-link" to={`/cabinet/${item.id}`}>
        {item.photoId && <AttachmentThumb id={item.photoId} size={48} />}{' '}
        <strong>{item.tradeName}</strong>
        {(item.strength || item.dosageForm) && (
          <span className="muted"> — {[item.strength, item.dosageForm].filter(Boolean).join(' ')}</span>
        )}
        <div>الكمية: {item.qtyText}</div>
        {item.profileName && <div className="muted">لـ {item.profileName}</div>}
        {item.nearestExpiryText && <div className="muted">أقرب صلاحية: {item.nearestExpiryText}</div>}
        <StatusBadge kind={status.kind} label={status.label} />
        {item.lowStock && <StatusBadge kind="warning" label="كمية قليلة" />}
      </Link>
    </li>
  );
}

export function CabinetPage() {
  const { state } = useCabinet();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const items = state.status === 'ready' ? state.data.items : [];
  const visible = useMemo(
    () =>
      items.filter((i) => matchesQuery(i, query) && (filter === 'all' || (filter === 'low' ? i.lowStock : i.status === filter))),
    [items, query, filter],
  );

  return (
    <>
      <PageHeader title="الخزانة" subtitle="الأدوية والمستلزمات الطبية" />

      {state.status === 'loading' && <StatusBadge kind="info" label="جارٍ التحميل" />}

      {state.status === 'error' && (
        <p role="alert">
          <StatusBadge kind="danger" label={state.message} />
        </p>
      )}

      {state.status === 'empty' && (
        <section className="card">
          <h2>أنشئ منزلك أولًا</h2>
          <p>تحتاج إلى منزل لتسجيل الأدوية فيه.</p>
          <Link to="/family">الذهاب إلى صفحة الأسرة</Link>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <p>
            <Link className="btn btn-primary btn-link" to="/cabinet/new">
              إضافة دواء
            </Link>
          </p>

          <div className="form">
            <label>
              بحث بالاسم أو الباركود
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          <div className="chips" role="group" aria-label="تصفية الأدوية">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                variant={filter === f.id ? 'primary' : 'secondary'}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {items.length === 0 ? (
            <section className="card">
              <p>لا توجد أدوية مسجلة بعد. اضغط "إضافة دواء" للبدء.</p>
            </section>
          ) : visible.length === 0 ? (
            <section className="card">
              <p>لا توجد نتائج مطابقة.</p>
            </section>
          ) : (
            <ul className="plain-list item-list">
              {visible.map((i) => (
                <ItemCard key={i.id} item={i} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
