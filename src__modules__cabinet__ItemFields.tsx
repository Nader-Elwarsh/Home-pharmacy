import type { ItemInput } from '@/core/domain/inventoryRules';
import { BarcodeScanner } from './BarcodeScanner';

interface Props {
  value: ItemInput;
  onChange: (value: ItemInput) => void;
}

const UNIT_SUGGESTIONS = ['قرص', 'كبسولة', 'مل', 'جرام', 'أمبول', 'لبوسة', 'جرعة', 'علبة', 'وحدة'];

export function ItemFields({ value, onChange }: Props) {
  const set = (key: keyof ItemInput) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <>
      <label>
        اسم الدواء
        <input value={value.tradeName} onChange={set('tradeName')} maxLength={120} />
      </label>

      <label>
        وحدة القياس
        <input
          value={value.baseUnit}
          onChange={set('baseUnit')}
          list="unit-suggestions"
          maxLength={20}
        />
        <datalist id="unit-suggestions">
          {UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </label>

      <label>
        عدد الوحدات في العبوة الواحدة
        <input
          value={value.unitsPerPack}
          onChange={set('unitsPerPack')}
          inputMode="numeric"
        />
        <span className="muted">
          مثال: شريط 10 أقراص = 10، زجاجة 100 مل = 100. إن كنت تعدّ العبوات فقط فاترك 1.
        </span>
      </label>

      <label>
        الباركود (اختياري)
        <input value={value.barcode} onChange={set('barcode')} inputMode="numeric" />
      </label>
      <BarcodeScanner onDetected={(code) => onChange({ ...value, barcode: code })} />

      <details>
        <summary>بيانات إضافية (اختيارية)</summary>
        <div className="form">
          <label>
            الاسم العلمي
            <input value={value.scientificName} onChange={set('scientificName')} maxLength={120} />
          </label>
          <label>
            المادة الفعالة
            <input value={value.activeIngredient} onChange={set('activeIngredient')} maxLength={120} />
          </label>
          <label>
            التركيز
            <input value={value.strength} onChange={set('strength')} maxLength={40} />
          </label>
          <label>
            الشكل الدوائي
            <input value={value.dosageForm} onChange={set('dosageForm')} maxLength={40} />
          </label>
          <label>
            ملاحظات
            <textarea value={value.notes} onChange={set('notes')} maxLength={500} rows={3} />
          </label>
        </div>
      </details>
    </>
  );
}
