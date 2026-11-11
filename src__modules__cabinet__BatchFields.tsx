import type { BatchInput } from '@/core/domain/inventoryRules';
import { PACK_STATE_LABELS, SELECTABLE_PACK_STATES, type PackState } from '@/core/domain/inventoryTypes';

interface Props {
  value: BatchInput;
  onChange: (value: BatchInput) => void;
  unitsPerPack: number;
  baseUnit: string;
}

export function BatchFields({ value, onChange, unitsPerPack, baseUnit }: Props) {
  const set = (key: keyof BatchInput) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <>
      <label>
        تاريخ الصلاحية
        <input
          value={value.expiry}
          onChange={set('expiry')}
          placeholder="مثال: 06/2027"
          inputMode="text"
        />
        <span className="muted">اكتب الشهر والسنة كما على العبوة، أو التاريخ الكامل.</span>
      </label>

      {unitsPerPack === 1 ? (
        <label>
          العدد ({baseUnit})
          <input value={value.packs} onChange={set('packs')} inputMode="numeric" />
        </label>
      ) : (
        <>
          <label>
            عدد العبوات (كل عبوة {unitsPerPack} {baseUnit})
            <input value={value.packs} onChange={set('packs')} inputMode="numeric" />
          </label>
          <label>
            {baseUnit} سائبة إضافية (اختياري)
            <input value={value.units} onChange={set('units')} inputMode="numeric" />
          </label>
        </>
      )}

      <label>
        رقم التشغيلة (اختياري)
        <input value={value.batchNo} onChange={set('batchNo')} maxLength={60} />
      </label>
      <label>
        تاريخ الشراء (اختياري)
        <input type="date" value={value.purchaseDate} onChange={set('purchaseDate')} />
      </label>
      <label>
        مكان التخزين (اختياري)
        <input value={value.location} onChange={set('location')} maxLength={60} />
      </label>
      <label>
        حالة العبوة
        <select
          value={value.packState}
          onChange={(e) => onChange({ ...value, packState: e.target.value as PackState })}
        >
          {SELECTABLE_PACK_STATES.map((s) => (
            <option key={s} value={s}>
              {PACK_STATE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
