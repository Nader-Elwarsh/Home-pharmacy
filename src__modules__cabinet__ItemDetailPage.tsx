import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EMPTY_BATCH_INPUT, type BatchInput } from '@/core/domain/inventoryRules';
import { PACK_STATE_LABELS } from '@/core/domain/inventoryTypes';
import {
  addBatch,
  archiveItem,
  toUserMessage,
  type ItemDetail,
} from '@/core/services/inventoryService';
import { BatchFields } from './BatchFields';
import { batchStatus } from './statusLabels';
import { useItemDetail } from './useCabinet';

function AddBatchForm({ item, onDone }: { item: ItemDetail; onDone: () => void }) {
  const [batch, setBatch] = useState<BatchInput>(EMPTY_BATCH_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addBatch(item.id, batch);
      setBatch(EMPTY_BATCH_INPUT);
      onDone();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <BatchFields
        value={batch}
        onChange={setBatch}
        unitsPerPack={item.unitsPerPack}
        baseUnit={item.baseUnit}
      />
      {error && (
        <p role="alert">
          <StatusBadge kind="danger" label={error} />
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'جارٍ الحفظ…' : 'إضافة تشغيلة'}
      </Button>
    </form>
  );
}

function Detail({ item, reload }: { item: ItemDetail; reload: () => void }) {
  const navigate = useNavigate();

  async function onArchive() {
    if (!window.confirm(`أرشفة "${item.tradeName}"؟ يختفي من الخزانة وتبقى سجلاته محفوظة.`)) return;
    await archiveItem(item.id);
    navigate('/cabinet');
  }

  return (
    <>
      <section className="card" aria-labelledby="item-title">
        <h2 id="item-title">{item.tradeName}</h2>
        <ul className="plain-list">
          {item.scientificName && <li>الاسم العلمي: {item.scientificName}</li>}
          {item.activeIngredient && <li>المادة الفعالة: {item.activeIngredient}</li>}
          {item.strength && <li>التركيز: {item.strength}</li>}
          {item.dosageForm && <li>الشكل: {item.dosageForm}</li>}
          <li>
            العبوة: {item.unitsPerPack} {item.baseUnit}
          </li>
          {item.barcode && <li>الباركود: {item.barcode}</li>}
          {item.notes && <li>ملاحظات: {item.notes}</li>}
        </ul>
        <p>
          <strong>الإجمالي: {item.totalQtyText}</strong>
        </p>
        <Button variant="secondary" onClick={onArchive}>
          أرشفة الصنف
        </Button>
      </section>

      <section className="card" aria-labelledby="batches-title">
        <h2 id="batches-title">التشغيلات</h2>
        {item.batches.length === 0 ? (
          <p className="muted">لا توجد تشغيلات. أضف تشغيلة لتسجيل الكمية والصلاحية.</p>
        ) : (
          <ul className="plain-list item-list">
            {item.batches.map((b) => {
              const s = batchStatus(b.status, b.daysLeft, b.empty);
              return (
                <li key={b.id} className="batch">
                  <div>
                    <strong>الصلاحية: {b.expiryText}</strong> <StatusBadge kind={s.kind} label={s.label} />
                  </div>
                  <div>الكمية: {b.qtyText}</div>
                  <div className="muted">
                    {PACK_STATE_LABELS[b.packState]}
                    {b.batchNo && ` — تشغيلة ${b.batchNo}`}
                    {b.location && ` — ${b.location}`}
                    {b.purchaseDate && ` — شراء ${b.purchaseDate}`}
                  </div>
                  {b.isFefoNext && (
                    <StatusBadge kind="info" label="الأقرب انتهاءً — يُنصح باستخدامها أولًا" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted">
          التنبيه بالأقرب انتهاءً مجرد اقتراح للعرض. القرار في الاستخدام لك أو للطبيب أو الصيدلي.
        </p>
      </section>

      <section className="card" aria-labelledby="add-batch-title">
        <h2 id="add-batch-title">إضافة تشغيلة</h2>
        <AddBatchForm item={item} onDone={reload} />
      </section>
    </>
  );
}

export function ItemDetailPage() {
  const { id = '' } = useParams();
  const { state, reload } = useItemDetail(id);

  return (
    <>
      <PageHeader title="تفاصيل الدواء" />
      <p>
        <Link to="/cabinet">← العودة إلى الخزانة</Link>
      </p>
      {state.status === 'loading' && <StatusBadge kind="info" label="جارٍ التحميل" />}
      {state.status === 'error' && (
        <p role="alert">
          <StatusBadge kind="danger" label={state.message} />
        </p>
      )}
      {state.status === 'empty' && <p>الصنف غير موجود أو تمت أرشفته.</p>}
      {state.status === 'ready' && <Detail item={state.data} reload={reload} />}
    </>
  );
}
