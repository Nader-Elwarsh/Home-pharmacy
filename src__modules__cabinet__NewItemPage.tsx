import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ErrorLine, Loading } from '@/components/Fields';
import { FilePicker } from '@/components/FilePicker';
import { PageHeader } from '@/components/PageHeader';
import {
  EMPTY_BATCH_INPUT,
  EMPTY_ITEM_INPUT,
  previewUnitsPerPack,
  type BatchInput,
  type ItemInput,
} from '@/core/domain/inventoryRules';
import { listProfileOptions } from '@/core/services/healthService';
import { addItemPhotos, createItem } from '@/core/services/inventoryService';
import { useLoader } from '@/hooks/useLoader';
import { useSubmit } from '@/hooks/useSubmit';
import { BatchFields } from './BatchFields';
import { ItemFields } from './ItemFields';

export function NewItemPage() {
  const navigate = useNavigate();
  const { state } = useLoader(async () => ({ profiles: await listProfileOptions() }), []);
  const [item, setItem] = useState<ItemInput>(EMPTY_ITEM_INPUT);
  const [batch, setBatch] = useState<BatchInput>(EMPTY_BATCH_INPUT);
  const [withBatch, setWithBatch] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const { busy, error, setError, run } = useSubmit();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    let newId = '';
    const ok = await run(async () => {
      newId = await createItem(item, withBatch ? batch : null);
      await addItemPhotos(newId, photos);
    });
    if (ok) navigate(`/cabinet/${newId}`);
  }

  return (
    <>
      <PageHeader title="إضافة دواء" />
      <p>
        <Link to="/cabinet">← العودة إلى الخزانة</Link>
      </p>
      {state.status === 'loading' && <Loading />}
      {state.status !== 'loading' && (
        <form onSubmit={onSubmit} className="form">
          <section className="card form">
            <h2>بيانات الدواء</h2>
            <ItemFields value={item} onChange={setItem} profiles={state.status === 'ready' ? state.data.profiles : []} />
          </section>

          <section className="card form">
            <h2>صور الدواء (اختياري)</h2>
            <FilePicker files={photos} onChange={setPhotos} accept="image/jpeg,image/png,image/webp" camera onProblem={setError} />
          </section>

          <section className="card form">
            <label className="check">
              <input type="checkbox" checked={withBatch} onChange={(e) => setWithBatch(e.target.checked)} />
              تسجيل الكمية وتاريخ الصلاحية الآن
            </label>
            {withBatch && (
              <BatchFields
                value={batch}
                onChange={setBatch}
                unitsPerPack={previewUnitsPerPack(item.unitsPerPack)}
                baseUnit={item.baseUnit.trim() || 'وحدة'}
              />
            )}
          </section>

          <ErrorLine message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </form>
      )}
    </>
  );
}
