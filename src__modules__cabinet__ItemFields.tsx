import type { ItemInput } from '@/core/domain/inventoryRules';
import { SelectField, TextAreaField, TextField } from '@/components/Fields';
import type { ProfileOption } from '@/core/services/healthService';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
  value: ItemInput;
  onChange: (value: ItemInput) => void;
  profiles: ProfileOption[];
}

const UNIT_SUGGESTIONS = ['قرص', 'كبسولة', 'مل', 'جرام', 'أمبول', 'لبوسة', 'جرعة', 'علبة', 'وحدة'];

export function ItemFields({ value, onChange, profiles }: Props) {
  const set = (key: keyof ItemInput) => (v: string) => onChange({ ...value, [key]: v });

  return (
    <>
      <TextField label="اسم الدواء" value={value.tradeName} onChange={set('tradeName')} maxLength={120} />
      <TextField label="وحدة القياس" value={value.baseUnit} onChange={set('baseUnit')} list="unit-suggestions" maxLength={20} />
      <datalist id="unit-suggestions">
        {UNIT_SUGGESTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <TextField
        label="عدد الوحدات في العبوة الواحدة"
        value={value.unitsPerPack}
        onChange={set('unitsPerPack')}
        inputMode="numeric"
        hint="مثال: شريط 10 أقراص = 10، زجاجة 100 مل = 100. إن كنت تعدّ العبوات فقط فاترك 1."
      />
      <SelectField
        label="الدواء لـ (اختياري)"
        value={value.profileId}
        onChange={set('profileId')}
        emptyLabel="للمنزل (غير محدد)"
        options={profiles.map((p) => ({ value: p.id, label: p.name }))}
      />
      <TextField
        label="تنبيه عند انخفاض الكمية إلى (اختياري)"
        value={value.lowStockAt}
        onChange={set('lowStockAt')}
        inputMode="numeric"
        hint={`بالوحدة الأساسية (${value.baseUnit.trim() || 'وحدة'}). يظهر تنبيه في الرئيسية عند الوصول لهذا الحد.`}
      />
      <TextField label="الباركود (اختياري)" value={value.barcode} onChange={set('barcode')} inputMode="numeric" />
      <BarcodeScanner onDetected={(code) => onChange({ ...value, barcode: code })} />

      <details>
        <summary>بيانات إضافية (اختيارية)</summary>
        <div className="form">
          <TextField label="الاسم العلمي" value={value.scientificName} onChange={set('scientificName')} maxLength={120} />
          <TextField label="المادة الفعالة" value={value.activeIngredient} onChange={set('activeIngredient')} maxLength={120} />
          <TextField label="التركيز" value={value.strength} onChange={set('strength')} maxLength={40} />
          <TextField label="الشكل الدوائي" value={value.dosageForm} onChange={set('dosageForm')} maxLength={40} />
          <TextAreaField label="ملاحظات" value={value.notes} onChange={set('notes')} maxLength={500} />
        </div>
      </details>
    </>
  );
}
