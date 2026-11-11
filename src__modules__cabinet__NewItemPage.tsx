import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import {
  EMPTY_BATCH_INPUT,
  EMPTY_ITEM_INPUT,
  previewUnitsPerPack,
  type BatchInput,
  type ItemInput,
} from '@/core/domain/inventoryRules';
import { createItem, toUserMessage } from '@/core/services/inventoryService';
import { BatchFields } from './BatchFields';
import { ItemFields } from './ItemFields';

export function NewItemPage() {
  const navigate = useNavigate();
  const [item, setItem] = useState<ItemInput>(EMPTY_ITEM_INPUT);
  const [batch, setBatch] = useState<BatchInput>(EMPTY_BATCH_INPUT);
  const [withBatch, setWithBatch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await createItem(item, withBatch ? batch : null);
      navigate(`/cabinet/${id}`);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="إضافة دواء" />
      <p>
        <Link to="/cabinet">← العودة إلى الخزانة</Link>
      </p>
      <form onSubmit={onSubmit} className="form">
        <section className="card form">
          <h2>بيانات الدواء</h2>
          <ItemFields value={item} onChange={setItem} />
        </section>

        <section className="card form">
          <label className="check">
            <input
              type="checkbox"
              checked={withBatch}
              onChange={(e) => setWithBatch(e.target.checked)}
            />
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

        {error && (
          <p role="alert">
            <StatusBadge kind="danger" label={error} />
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </Button>
      </form>
    </>
  );
}
