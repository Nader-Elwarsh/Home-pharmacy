import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AttachmentThumb } from '@/components/AttachmentView';
import { Button } from '@/components/Button';
import { ErrorLine, Loading } from '@/components/Fields';
import { FilePicker } from '@/components/FilePicker';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EMPTY_BATCH_INPUT, type BatchInput, type ItemInput } from '@/core/domain/inventoryRules';
import { PACK_STATE_LABELS } from '@/core/domain/inventoryTypes';
import { listProfileOptions } from '@/core/services/healthService';
import {
  addBatch,
  addItemPhotos,
  archiveItem,
  loadItemInput,
  markOpened,
  removeItemPhoto,
  reverseTransaction,
  updateItem,
  type ItemDetail,
} from '@/core/services/inventoryService';
import { addShopping } from '@/core/services/planningService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';
import { BatchFields } from './BatchFields';
import { ItemFields } from './ItemFields';
import { StockActionForm, type StockMode } from './StockActionForm';
import { batchStatus } from './statusLabels';
import { useItemDetail } from './useCabinet';

function AddBatchForm({ item, onDone }: { item: ItemDetail; onDone: () => void }) {
  const [batch, setBatch] = useState<BatchInput>(EMPTY_BATCH_INPUT);
  const { busy, error, run } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => addBatch(item.id, batch))) {
      setBatch(EMPTY_BATCH_INPUT);
      onDone();
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <BatchFields value={batch} onChange={setBatch} unitsPerPack={item.unitsPerPack} baseUnit={item.baseUnit} />
      <ErrorLine message={error} />
      <Button type="submit" disabled={busy}>
        {busy ? 'جارٍ الحفظ…' : 'إضافة عبوات'}
      </Button>
    </form>
  );
}

function EditItemForm({ item, onDone, onCancel }: { item: ItemDetail; onDone: () => void; onCancel: () => void }) {
  const { state } = useLoader(
    async () => ({ input: await loadItemInput(item.id), profiles: await listProfileOptions() }),
    [item.id],
  );
  const [value, setValue] = useState<ItemInput | null>(null);
  const { busy, error, run } = useSubmit();

  if (state.status !== 'ready' || !state.data.input) return <Loading />;
  const current = value ?? state.data.input;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => updateItem(item.id, current))) onDone();
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <ItemFields value={current} onChange={setValue} profiles={state.data.profiles} />
      <ErrorLine message={error} />
      <div className="row">
        <Button type="submit" disabled={busy}>حفظ التعديل</Button>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
      </div>
    </form>
  );
}

function PhotosSection({ item, reload }: { item: ItemDetail; reload: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const { busy, error, setError, run } = useSubmit();

  async function save() {
    if (await run(() => addItemPhotos(item.id, files))) {
      setFiles([]);
      reload();
    }
  }
  async function remove(id: string) {
    if (!window.confirm('حذف هذه الصورة؟')) return;
    if (await run(() => removeItemPhoto(item.id, id))) reload();
  }

  return (
    <section className="card">
      <h2>صور الدواء</h2>
      {item.photoIds.length === 0 && <p className="muted">لا توجد صور.</p>}
      <div className="thumbs">
        {item.photoIds.map((id) => (
          <div key={id}>
            <AttachmentThumb id={id} size={96} />
            <div>
              <button type="button" className="btn-link" onClick={() => void remove(id)}>
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
      <FilePicker files={files} onChange={setFiles} accept="image/jpeg,image/png,image/webp" camera onProblem={setError} />
      {files.length > 0 && (
        <Button disabled={busy} onClick={() => void save()}>
          حفظ الصور
        </Button>
      )}
      <ErrorLine message={error} />
    </section>
  );
}

function Detail({ item, reload }: { item: ItemDetail; reload: () => void }) {
  const navigate = useNavigate();
  const { state: pState } = useLoader(async () => ({ profiles: await listProfileOptions() }), []);
  const profiles = pState.status === 'ready' ? pState.data.profiles : [];
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<{ batchId: string; mode: StockMode } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { error, run } = useSubmit();

  async function onArchive() {
    if (!window.confirm(`أرشفة "${item.tradeName}"؟ يختفي من الخزانة وتبقى سجلاته محفوظة.`)) return;
    await archiveItem(item.id);
    navigate('/cabinet');
  }

  async function toShopping() {
    const ok = await run(() => addShopping({ name: item.tradeName, qty: '', profileId: item.profileId ?? '', priority: 'normal', reason: 'من الخزانة' }, item.id));
    if (ok) setNote('أُضيف إلى قائمة المشتريات');
  }

  async function onReverse(txId: string) {
    if (!window.confirm('تصحيح هذه الحركة؟ تُسجَّل حركة عكسية والحركة الأصلية تبقى في السجل.')) return;
    if (await run(() => reverseTransaction(txId, crypto.randomUUID(), 'تصحيح'))) reload();
  }

  async function onOpen(batchId: string) {
    if (await run(() => markOpened(batchId))) reload();
  }

  const done = () => {
    setAction(null);
    reload();
  };

  return (
    <>
      <section className="card" aria-labelledby="item-title">
        <h2 id="item-title">{item.tradeName}</h2>
        {editing ? (
          <EditItemForm item={item} onDone={() => { setEditing(false); reload(); }} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <ul className="plain-list">
              {item.profileName && <li>الدواء لـ: {item.profileName}</li>}
              {item.scientificName && <li>الاسم العلمي: {item.scientificName}</li>}
              {item.activeIngredient && <li>المادة الفعالة: {item.activeIngredient}</li>}
              {item.strength && <li>التركيز: {item.strength}</li>}
              {item.dosageForm && <li>الشكل: {item.dosageForm}</li>}
              <li>العبوة: {item.unitsPerPack} {item.baseUnit}</li>
              {item.lowStockAt !== undefined && <li>تنبيه عند: {item.lowStockAt} {item.baseUnit}</li>}
              {item.barcode && <li>الباركود: {item.barcode}</li>}
              {item.notes && <li>ملاحظات: {item.notes}</li>}
            </ul>
            <p className="big-count">الإجمالي: {item.totalQtyText}</p>
            <div className="row">
              <Button variant="secondary" onClick={() => setEditing(true)}>تعديل البيانات</Button>
              <Button variant="secondary" onClick={() => void toShopping()}>أضف للمشتريات</Button>
              <Button variant="secondary" onClick={() => void onArchive()}>أرشفة الصنف</Button>
            </div>
            {note && <StatusBadge kind="ok" label={note} />}
          </>
        )}
        <ErrorLine message={error} />
      </section>

      <PhotosSection item={item} reload={reload} />

      <section className="card" aria-labelledby="batches-title">
        <h2 id="batches-title">العبوات</h2>
        {item.batches.length === 0 ? (
          <p className="muted">لا توجد عبوات. أضف عبوات لتسجيل الكمية والصلاحية.</p>
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
                    {b.productionDate && ` — إنتاج ${b.productionDate}`}
                    {b.batchNo && ` — تشغيلة ${b.batchNo}`}
                    {b.location && ` — ${b.location}`}
                    {b.purchaseDate && ` — شراء ${b.purchaseDate}`}
                  </div>
                  {b.isFefoNext && <StatusBadge kind="info" label="الأقرب انتهاءً — يُنصح باستخدامها أولًا" />}
                  <div className="chips">
                    {!b.empty && <Button variant="secondary" onClick={() => setAction({ batchId: b.id, mode: 'consume' })}>استهلاك</Button>}
                    {!b.empty && <Button variant="secondary" onClick={() => setAction({ batchId: b.id, mode: 'dispense' })}>صرف لشخص</Button>}
                    <Button variant="secondary" onClick={() => setAction({ batchId: b.id, mode: 'add' })}>إضافة كمية</Button>
                    <Button variant="secondary" onClick={() => setAction({ batchId: b.id, mode: 'adjust' })}>جرد</Button>
                    {!b.empty && b.packState === 'sealed' && <Button variant="secondary" onClick={() => void onOpen(b.id)}>تم الفتح</Button>}
                  </div>
                  {action?.batchId === b.id && (
                    <StockActionForm item={item} batchId={b.id} mode={action.mode} profiles={profiles} onDone={done} onCancel={() => setAction(null)} />
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
        <h2 id="add-batch-title">إضافة عبوات جديدة (صلاحية مختلفة)</h2>
        <AddBatchForm item={item} onDone={reload} />
      </section>

      <section className="card">
        <h2>سجل الحركات</h2>
        {item.history.length === 0 ? (
          <p className="muted">لا توجد حركات.</p>
        ) : (
          <ul className="plain-list">
            {item.history.map((h) => (
              <li key={h.id}>
                <strong>{h.typeLabel}</strong> {h.qtyText} — صلاحية {h.batchLabel}
                <div className="muted">
                  {new Date(h.at).toLocaleString('ar-EG')}
                  {h.profileName && ` — ${h.profileName}`}
                  {h.note && ` — ${h.note}`}
                  {h.reversed && ' — (تم تصحيحها)'}
                </div>
                {h.reversible && (
                  <button type="button" className="btn-link" onClick={() => void onReverse(h.id)}>
                    تصحيح هذه الحركة
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
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
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorLine message={state.message} />}
      {state.status === 'empty' && <p>الصنف غير موجود أو تمت أرشفته.</p>}
      {state.status === 'ready' && <Detail item={state.data} reload={reload} />}
    </>
  );
}
