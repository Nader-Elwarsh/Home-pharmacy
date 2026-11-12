import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorLine, Loading, SelectField } from '@/components/Fields';
import { PageHeader } from '@/components/PageHeader';
import { PACK_STATE_LABELS } from '@/core/domain/inventoryTypes';
import { EXPIRY_STATUS_TEXT, REPORT_DISCLAIMER } from '@/core/domain/report';
import { listProfileOptions } from '@/core/services/healthService';
import { buildReportText, filterReportRows, loadReportRows } from '@/core/services/reportService';
import { useLoader } from '@/hooks/useLoader';

export function ReportPage() {
  const { state } = useLoader(async () => {
    const data = await loadReportRows();
    return data ? { data, profiles: await listProfileOptions() } : null;
  }, []);
  const [profileId, setProfileId] = useState('');
  const [openedOnly, setOpenedOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [includeBatchNo, setIncludeBatchNo] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const scope = { profileId: profileId || undefined, openedOnly, expiringOnly, includeExpired };
  const rows = useMemo(
    () => (state.status === 'ready' ? filterReportRows(state.data.data.rows, scope) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, profileId, openedOnly, expiringOnly, includeExpired],
  );

  async function text(): Promise<string> {
    if (state.status !== 'ready') return '';
    const name = state.data.profiles.find((p) => p.id === profileId)?.name;
    return buildReportText(state.data.data, scope, { includeBatchNo, includeNotes }, name);
  }

  async function share() {
    const t = await text();
    try {
      if (navigator.share) await navigator.share({ title: 'الأدوية الموجودة لدي', text: t });
      else { await navigator.clipboard.writeText(t); setMsg('تم نسخ التقرير'); }
    } catch {
      setMsg('تعذرت المشاركة. جرّب النسخ');
    }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(await text()); setMsg('تم نسخ التقرير'); } catch { setMsg('تعذر النسخ'); }
  }

  return (
    <>
      <PageHeader title="تقرير الأدوية الموجودة لدي" subtitle="للاطلاع أو للعرض على الطبيب أو الصيدلي" />
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorLine message={state.message} />}
      {state.status === 'empty' && <p>أنشئ المنزل أولًا.</p>}
      {state.status === 'ready' && (
        <>
          <section className="card form no-print">
            <SelectField label="لمن؟" value={profileId} onChange={setProfileId} emptyLabel="المنزل بالكامل" options={state.data.profiles.map((p) => ({ value: p.id, label: p.name }))} />
            {([
              ['المفتوح فقط', openedOnly, setOpenedOnly],
              ['القريب الانتهاء والمنتهي فقط', expiringOnly, setExpiringOnly],
              ['تضمين المنتهي الصلاحية', includeExpired, setIncludeExpired],
              ['إظهار رقم التشغيلة', includeBatchNo, setIncludeBatchNo],
              ['إظهار الملاحظات', includeNotes, setIncludeNotes],
            ] as const).map(([label, val, setter]) => (
              <label key={label} className="check">
                <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} />
                {label}
              </label>
            ))}
            <div className="row">
              <Button onClick={() => window.print()}>طباعة / حفظ PDF</Button>
              <Button variant="secondary" onClick={() => void share()}>مشاركة</Button>
              <Button variant="secondary" onClick={() => void copy()}>نسخ النص</Button>
            </div>
            {msg && <p role="status">{msg}</p>}
          </section>

          <section className="card">
            <h2>{state.data.profiles.find((p) => p.id === profileId)?.name ?? state.data.data.householdName}</h2>
            <p className="muted">بتاريخ {state.data.data.dateText}</p>
            {rows.length === 0 ? (
              <p>لا توجد أدوية مطابقة.</p>
            ) : (
              <ol>
                {rows.map((r, i) => (
                  <li key={`${r.itemId}-${i}`}>
                    <strong>{[r.name, r.strength, r.dosageForm].filter(Boolean).join(' ')}</strong>
                    <div>
                      {r.activeIngredient && `المادة الفعالة: ${r.activeIngredient} — `}
                      الكمية: {r.qtyText} — {PACK_STATE_LABELS[r.packState]} — الصلاحية: {r.expiryText} ({EXPIRY_STATUS_TEXT[r.expiryStatus]})
                      {includeBatchNo && r.batchNo && ` — تشغيلة ${r.batchNo}`}
                      {includeNotes && r.notes && ` — ${r.notes}`}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="muted">{REPORT_DISCLAIMER}</p>
          </section>
        </>
      )}
    </>
  );
}
