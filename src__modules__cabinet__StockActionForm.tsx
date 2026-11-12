import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { ErrorLine, SelectField, TextField } from '@/components/Fields';
import { useSubmit } from '@/hooks/useSubmit';
import {
  ExpiredBatchWarning,
  recordAdjustment,
  recordPurchase,
  recordUsage,
  type ItemDetail,
} from '@/core/services/inventoryService';
import type { ProfileOption } from '@/core/services/healthService';

export type StockMode = 'consume' | 'dispense' | 'adjust' | 'add';

const TITLES: Record<StockMode, string> = {
  consume: 'تسجيل استهلاك',
  dispense: 'تسجيل صرف لشخص آخر',
  adjust: 'تسوية جرد',
  add: 'إضافة كمية',
};

interface Props {
  item: ItemDetail;
  batchId: string;
  mode: StockMode;
  profiles: ProfileOption[];
  onDone: () => void;
  onCancel: () => void;
}

export function StockActionForm({ item, batchId, mode, profiles, onDone, onCancel }: Props) {
  const [packs, setPacks] = useState('');
  const [units, setUnits] = useState('');
  const [profileId, setProfileId] = useState('');
  const [note, setNote] = useState('');
  const [needConfirm, setNeedConfirm] = useState(false);
  // معرّف واحد للنموذج: ضغطتان متتاليتان لا تسجلان حركتين
  const opId = useRef(crypto.randomUUID());
  const { busy, error, run } = useSubmit();

  async function submit(allowExpired: boolean) {
    const ok = await run(async () => {
      try {
        if (mode === 'consume' || mode === 'dispense') {
          await recordUsage({ batchId, packs, units, type: mode, profileId, note, opId: opId.current, allowExpired });
        } else if (mode === 'adjust') {
          await recordAdjustment({ batchId, packs, units, note, opId: opId.current });
        } else {
          await recordPurchase({ batchId, packs, units, opId: opId.current });
        }
      } catch (e) {
        if (e instanceof ExpiredBatchWarning) setNeedConfirm(true);
        throw e;
      }
    });
    if (ok) onDone();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNeedConfirm(false);
    void submit(false);
  }

  const packLabel = item.unitsPerPack === 1 ? `العدد (${item.baseUnit})` : 'عدد العبوات';
  const heading = mode === 'adjust' ? `${TITLES[mode]} — أدخل الكمية الموجودة فعليًا الآن` : TITLES[mode];

  return (
    <form onSubmit={onSubmit} className="form card">
      <h3>{heading}</h3>
      <TextField label={packLabel} value={packs} onChange={setPacks} inputMode="numeric" />
      {item.unitsPerPack !== 1 && (
        <TextField label={`${item.baseUnit} سائبة`} value={units} onChange={setUnits} inputMode="numeric" />
      )}
      {(mode === 'consume' || mode === 'dispense') && (
        <SelectField
          label={mode === 'consume' ? 'استُخدم بواسطة (اختياري)' : 'صُرف لـ (اختياري)'}
          value={profileId}
          onChange={setProfileId}
          emptyLabel="غير محدد"
          options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        />
      )}
      {mode !== 'add' && (
        <TextField
          label={mode === 'adjust' ? 'سبب التسوية (إلزامي)' : 'ملاحظة (اختياري)'}
          value={note}
          onChange={setNote}
          maxLength={200}
        />
      )}
      <ErrorLine message={error} />
      <div className="row">
        {needConfirm ? (
          <Button disabled={busy} onClick={() => void submit(true)}>
            نعم، سجّل رغم انتهاء الصلاحية
          </Button>
        ) : (
          <Button type="submit" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
