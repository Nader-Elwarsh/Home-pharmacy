import type { BatchInput } from '@/core/domain/inventoryRules';
import { PACK_STATE_LABELS, SELECTABLE_PACK_STATES } from '@/core/domain/inventoryTypes';
import { SelectField, TextField } from '@/components/Fields';

interface Props {
  value: BatchInput;
  onChange: (value: BatchInput) => void;
  unitsPerPack: number;
  baseUnit: string;
}

export function BatchFields({ value, onChange, unitsPerPack, baseUnit }: Props) {
  const set = (key: keyof BatchInput) => (v: string) => onChange({ ...value, [key]: v });

  return (
    <>
      <TextField
        label="تاريخ الصلاحية"
        value={value.expiry}
        onChange={set('expiry')}
        placeholder="مثال: 06/2027"
        hint="اكتب الشهر والسنة كما على العبوة، أو التاريخ الكامل."
      />
      <TextField label="تاريخ الإنتاج (اختياري)" value={value.productionDate} onChange={set('productionDate')} placeholder="مثال: 06/2024" />

      {unitsPerPack === 1 ? (
        <TextField label={`العدد (${baseUnit})`} value={value.packs} onChange={set('packs')} inputMode="numeric" />
      ) : (
        <>
          <TextField label={`عدد العبوات (كل عبوة ${unitsPerPack} ${baseUnit})`} value={value.packs} onChange={set('packs')} inputMode="numeric" />
          <TextField label={`${baseUnit} سائبة إضافية (اختياري)`} value={value.units} onChange={set('units')} inputMode="numeric" />
        </>
      )}

      <TextField label="رقم التشغيلة المطبوع على العبوة (اختياري)" value={value.batchNo} onChange={set('batchNo')} maxLength={60} />
      <TextField label="تاريخ الشراء (اختياري)" type="date" value={value.purchaseDate} onChange={set('purchaseDate')} />
      <TextField label="مكان التخزين (اختياري)" value={value.location} onChange={set('location')} maxLength={60} />
      <SelectField
        label="حالة العبوة"
        value={value.packState}
        onChange={set('packState')}
        options={SELECTABLE_PACK_STATES.map((s) => ({ value: s, label: PACK_STATE_LABELS[s] }))}
      />
    </>
  );
}
