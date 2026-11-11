# صيدلية البيت — الأساس المعماري (قبل P0)

الحالة: مسودة للاعتماد. لم يُكتب أي كود تطبيق بعد.

---

## 1. تحليل المتطلبات (الخلاصة)

**المنتج:** منصة ويب Offline-First (PWA) عربية RTL لإدارة مخزون الدواء المنزلي والملف الصحي للأسرة.

**ثلاثة أعمدة لا تُمَس:**
1. **دقة المخزون:** دفتر حركات append-only، لا مخزون سالب، لا خصم مزدوج.
2. **خصوصية البيانات الصحية:** عزل بالمنزل، صلاحيات على مستوى الخادم، لا ملفات عامة.
3. **السلامة الطبية:** التطبيق لا يشخّص ولا يصف ولا يقترح جرعات ولا بدائل.

**خارج النطاق صراحةً:** متجر أدوية، تشخيص، اشتراكات مدفوعة (المعمارية تسمح بها لاحقًا فقط).

---

## 2. سجل القرارات المعمارية (ADR)

| # | القرار | السبب | البديل المرفوض |
|---|--------|-------|----------------|
| 1 | **Dexie/IndexedDB هي مصدر الحقيقة للواجهة**، والواجهة لا تقرأ من Firestore مباشرة | تحكم كامل في Offline، سلوك متوقع | الاعتماد على Firestore Offline Persistence (المواصفة تمنعه) |
| 2 | **Outbox Queue**: كل تعديل = عملية بـ `opId` (UUID v4) تُخزَّن محليًا ثم تُرفع | منع التكرار عند إعادة الإرسال | رفع مباشر بدون طابور |
| 3 | **المخزون = Ledger**: جدول `stockTransactions` للإضافة فقط. الرصيد لكل تشغيلة = مجموع الحركات | لا حذف صامت، تصحيح بحركة عكسية `reversesId` | حقل كمية يُعدَّل مباشرة |
| 4 | **العمليات الحساسة (صرف/تسوية) تمر عبر Cloud Function** تتحقق ذريًا من الرصيد والصلاحية وتسجل `opId` كمعالَج (idempotency) | جهازان قد يخصمان آخر كمية معًا؛ قواعد Firestore لا تكفي | معاملة من العميل |
| 5 | **حالة العملية المحلية**: `pending → synced / rejected`. الواجهة تعرض "لم تُعتمد سحابيًا" للمعلق | المواصفة: لا تعرض غير المعتمد كنهائي | عرض كل شيء كنهائي |
| 6 | **العزل بالمنزل**: كل بيانات المنزل تحت `households/{hid}/…`، وقواعد Firestore/Storage تتحقق من العضوية والدور | عزل حقيقي على الخادم لا الواجهة | حقل `householdId` مع فلترة في العميل |
| 7 | **لوحة الإدارة منفصلة**: Custom Claim `admin`، حزمة/مسار منفصل (lazy)، وقواعد تمنع الإدارة من قراءة `households/**` | المواصفة: لا وصول إدارة للملفات الطبية | أدوار إدارة داخل نفس التطبيق |
| 8 | **الكتالوج المركزي منفصل** (`catalog/**` قراءة للجميع، كتابة للإدارة فقط). المستخدم يرسل `catalogSuggestions` تدخل طابور مراجعة | لا يتحول اقتراح لمنتج معتمد تلقائيًا | كتابة مباشرة من المستخدم |
| 9 | **التواريخ**: الصلاحية والمواعيد التقويمية كنص `YYYY-MM-DD`؛ الأحداث الزمنية UTC ISO مع `tz` للعرض | تجنب أخطاء المناطق الزمنية | `Date` محلي |
| 10 | **حل التعارض**: الكيانات العادية Last-Writer-Wins لكل حقل (`updatedAt` + `deviceId`)؛ الحركات لا تتعارض (append-only)؛ الرصيد يُحسب خادميًا | بساطة وصحة | CRDT كامل (مبالغة) |
| 11 | **المرفقات**: Cloud Storage تحت `households/{hid}/files/…`، قواعد وصول بالعضوية، روابط مؤقتة للمشاركة فقط، تحقق من النوع والحجم، النسخة الأصلية تُحفظ دائمًا | خصوصية | روابط عامة |
| 12 | **OCR كواجهة قابلة للاستبدال** (`OcrProvider`)، نتائجه مقترحات تُراجَع يدويًا ولا تُحفظ تلقائيًا | الدقة مع العربية غير مضمونة | حفظ تلقائي |
| 13 | **الواجهة**: React + Vite + TS، React Router، Zustand للحالة المؤقتة، `useLiveQuery` من Dexie للبيانات. CSS بخصائص منطقية (`inline-start`) لـ RTL حقيقي | بساطة وخفة | Redux ثقيل |
| 14 | **طبقات**: `ui → services/domain → repositories → database/sync`. ممنوع حساب مخزون أو صلاحيات داخل المكونات | قابلية الاختبار | منطق داخل المكونات |
| 15 | **الاختبارات**: Vitest + fake-indexeddb للمنطق، Firebase Emulator Suite لقواعد الأمان والـ Functions، Playwright للواجهة | | |
| 16 | **المنطق الدوائي بلا ذكاء**: لا اقتراح بدائل ولا جرعات. الجرعات بالكتالوج مرجعية ومعنونة صراحةً | سلامة | |
| 17 | **قابلية الاشتراكات لاحقًا**: جدول `subscriptions` وحقل `plan` على المنزل بلا أي ميزة مقفولة الآن | | |

**ملاحظة صراحة على حدود الإشعارات:** لا ضمان لوصول الإشعار والتطبيق مغلق، خصوصًا iOS. نبدأ بإشعارات داخل التطبيق + Local/Browser حيث تتوفر، ويُوثَّق القيد في الواجهة.

---

## 3. مخطط البيانات والعلاقات

كل كيان: `id` (UUID)، `schemaVersion`، `createdAt`، `updatedAt`، `deletedAt?` (أرشفة لا حذف)، `updatedBy`.

### النواة
- **users** (uid, displayName, email)
- **households** (id, name, ownerUid, plan)
- **householdMembers** (householdId, uid, role: owner|admin|member|viewer|care_follower, status, invitedBy)
- **familyProfiles** (householdId, name, photoRef?, birthDate?, linkedUid?) — ملف الفرد قد لا يكون له حساب

### المخزون
- **productCatalog** (عام) ← تعريف المنتج المعتمد: tradeName, scientificName, activeIngredient, strength, dosageForm, packSize, baseUnit, unitsPerPack, manufacturer, country, sources[], lastReviewedAt, approvalStatus
- **productBarcodes** (barcode → catalogId) — عدة باركودات لمنتج
- **inventoryItems** (householdId, catalogId?, اسم مخصص عند غياب الكتالوج, ملاحظات, صورة) ← تعريف الصنف عند المنزل
- **batches** (itemId, batchNo, expiryDate, purchaseDate, storageLocationId, packState: sealed|opened|partial|consumed|damaged|expired|quarantined, openedAt?)
- **storageLocations** (householdId, name)
- **stockTransactions** (batchId, type: purchase|dispense|consume|adjust|reversal, qtyBaseUnits ±, opId, reversesId?, note, at, by) — **للإضافة فقط**
- رصيد الدفعة = Σ الحركات (يُخزَّن مخبئيًا `balanceCache` ويُعاد حسابه خادميًا)

### الصحة
- **medicalVisits** (profileId, date, doctorId?, reason?)
- **medicalDocuments** (profileId, kind, title, date, facility, doctorId?, visitId?, fileRefs[], tags[], source)
- **labResults / radiologyReports** → امتداد لـ medicalDocuments بقيم مراجَعة (`reviewedByUser`)
- **prescriptions** (profileId, doctorId?, visitDate, imageRef?, notes) و **prescriptionItems** (writtenName, matchedCatalogId?, strength, qty, instructionsText, duration?, dispenseStatus) — لا مطابقة مخترعة
- **treatments** (profileId, name, start, end, prescriptionId?, status) و **treatmentItems**
- **doseSchedules** (يدخلها المستخدم فقط) و **doseLogs** (taken|missed|skipped|postponed, reason?) — **منفصلة تمامًا عن stockTransactions**

### الرعاية
- **careAssignments** (profileId, followerUid, role, permissions{view,edit,share}, consentAt)
- **careTasks** (assignmentId, title, due, status, confirmedBy, confirmedAt)
- **reminders** (kind: inventory|health, target, schedule, status, assigneeUid)

### الأدلة
- **doctors / clinics / pharmacies** (عامة، status: unreviewed|in_review|approved|needs_update|suspended, lastConfirmedAt)
- **personalContacts** (خاص بالمستخدم) و **favorites** (إشارة لجهة عامة + ملاحظات خاصة)

### أخرى
- **shoppingItems**, **auditLogs** (household-scoped)
- **المجتمع:** featureSuggestions, bugReports, votes (مفتاح مركّب `suggestionId_uid` = صوت واحد), feedback, roadmapItems, announcements, releaseNotes
- **subscriptions** (محجوز)

### فهارس رئيسية
`batches(itemId, expiryDate)` · `stockTransactions(batchId, at)` · `stockTransactions(opId)` فريد · `medicalDocuments(profileId, date)` · `productBarcodes(barcode)` فريد · `votes(suggestionId, uid)` فريد.

### قواعد الحذف
- بيانات صحية ومخزون: أرشفة (`deletedAt`) فقط، والحذف النهائي بطلب صريح من المالك.
- الحركات لا تُحذف إطلاقًا.

---

## 4. خريطة الوحدات والصفحات

التنقل السفلي (هاتف): **الرئيسية · الخزانة · الصحة · الأسرة · المزيد**

| الوحدة | الصفحات |
|---|---|
| الرئيسية | ملخص، إضافة سريعة، تنبيهات |
| الخزانة | قائمة الأصناف، تفاصيل صنف/تشغيلات، إضافة (يدوي/كتالوج/باركود/تصوير)، حركات |
| الصحة | ملف الفرد، Timeline، مستندات، روشتات، علاجات |
| الأسرة | لوحة المتابعة، المهام، المتابعون |
| الأدلة | عام، شخصي، اقتراح/بلاغ |
| المواعيد والتذكيرات | تقويم، قائمة، سجل |
| المشتريات | قائمة |
| التقارير | مخزون، صحي، أسرة، تقرير "الأدوية الموجودة لدي" |
| المجتمع | اقتراحات، بلاغات، أخبار، خارطة طريق، سجل التغييرات |
| الإعدادات | الحساب، المنزل والأعضاء، النسخ الاحتياطي، المزامنة |
| الإدارة (منفصلة) | اقتراحات، بلاغات، خارطة، أخبار، إصدارات، إعلانات، تحليلات، مراجعة الكتالوج والأدلة |

---

## 5. خطة المراحل المفصلة

كل مرحلة تنتهي بتقرير (المنفَّذ، الملفات، الاختبارات الفعلية، الأخطاء، المخاطر، طريقة التجربة) ولا يُنتقل قبل اعتمادها.

| المرحلة | المخرجات | شرط الخروج |
|---|---|---|
| **P0** | Vite/React/TS، RTL، SPA، PWA، Dexie مبدئي، نظام تصميم، هيكل الطبقات، اختبارات | معايير القبول بالأسفل |
| P1 | Google Auth، المنازل، الأعضاء، الدعوات، قواعد Firestore/Storage | اختبار عزل منزلين بالـ Emulator |
| P2 | مستودعات Dexie، Migrations | اختبارات ترحيل |
| P3 | الأصناف، التشغيلات، الباركود (ZXing)، الكتالوج | إضافة يدوية/باركود |
| P4 | الحركات، العكس، منع السالب، idempotency | اختبارات الخصم المزدوج والسالب |
| P5 | المستندات، الروشتات، Timeline | رفع/بحث/استرجاع |
| P6 | العلاجات، الجرعات، الرعاية | فصل الجرعات عن المخزون |
| P7 | Outbox، Sync Engine، حل التعارض | إعادة إرسال بلا تكرار |
| P8 | Firebase + Functions + مزامنة أجهزة | اختبار آخر كمية من جهازين |
| P9 | الأدلة والمراجعة | الدليل الشخصي لا يظهر لغيرك |
| P10 | التقارير والتذكيرات | PDF وطباعة |
| P11 | المجتمع ولوحة الإدارة | عزل الإدارة |
| P12 | النسخ الاحتياطي والاستعادة | استعادة آمنة بدون حذف قبل النجاح |
| P13 | تدقيق أمان/أداء/PWA/Offline وإطلاق | الـ 34 اختبار قبول + الإضافية |

بعد كل مرحلتين مستقرتين: ZIP كامل + README محدث.

---

## 6. المخاطر

### فنية
- **تعارض أجهزة على آخر كمية** ← Cloud Function ذرية + `opId`.
- **تضخم IndexedDB بالمرفقات** ← حدود حجم، ضغط صور، تخزين المرفقات منفصلًا عن السجلات.
- **iOS PWA:** قيود على الإشعارات والتخزين وقد يمسح النظام IndexedDB ← تنبيه المستخدم + نسخ احتياطي دوري.
- **OCR عربي ضعيف** ← مقترحات فقط، ومراجعة إجبارية.
- **ترحيل البيانات (Migrations)** ← `schemaVersion` واختبارات ترحيل منذ P2.
- **تكلفة Firestore مع القراءات الكثيفة** ← مزامنة تفاضلية بـ `updatedAt`.

### طبية
- **ظهور معلومة كأنها توصية علاجية** ← وسم "معلومة مرجعية" ثابت، ولا بدائل ولا جرعات شخصية.
- **مطابقة خاطئة بين دواءين متشابهي الاسم** ← لا دمج بالاسم؛ التحقق من المادة والتركيز والشكل.
- **اعتماد المستخدم على تذكير الجرعة** ← إفصاح صريح عن حدود الإشعارات.
- **بيانات كتالوج غير موثقة** ← لا علامة اعتماد قبل مراجعة، وحقل مصدر إلزامي.

### أمنية
- **تسرب بين المنازل** ← قواعد خادمية + اختبارات Emulator للحالات السلبية.
- **وصول الإدارة لبيانات صحية** ← منع على مستوى القواعد.
- **روابط المشاركة** ← صلاحية قصيرة وقابلة للإلغاء ونطاق محدد.
- **رفع ملفات ضارة** ← تحقق نوع/حجم، عدم تنفيذ، عزل.
- **التصويت المتكرر** ← مفتاح مركّب فريد على الخادم.
- **أخطاء مستقبلية بإعدادات Firebase** ← عدم تأجيل القواعد بعد P1.

---

## 7. معايير قبول P0

1. `npm run build` ينجح بلا أخطاء TypeScript.
2. `npm test` (Vitest) يمر، ويشمل: فتح Dexie وكتابة/قراءة سجل تجريبي معزول، واختبار طبقة المستودع.
3. التطبيق يعمل SPA بتنقل بين 5 صفحات هيكلية (بلا أزرار وهمية: ما لم يُنفَّذ يُعرض كـ"قريبًا" صراحة).
4. `dir="rtl"` و`lang="ar"` على الجذر، والتخطيط بخصائص منطقية، وخط عربي مناسب.
5. PWA: manifest صحيح، Service Worker مسجَّل، ويفتح التطبيق بعد التحميل الأول دون اتصال (يُختبر فعليًا).
6. هيكل المجلدات بحسب المواصفة، وطبقات UI/domain/repositories/database منفصلة، وقاعدة lint تمنع استيراد `database` من المكونات مباشرة.
7. نظام تصميم أساسي: ألوان مع نص/رمز للحالة (ليس لونًا فقط)، أحجام خط كبيرة، أزرار بمساحة لمس ≥ 44px.
8. اختبار Playwright أساسي: الفتح، التنقل، RTL.
9. README بتعليمات التشغيل، وتقرير P0 بنتائج الاختبارات الفعلية.
10. لا بيانات صحية تجريبية تظهر كحقيقية.

---

## 8. قرارات أحتاج اعتمادك عليها قبل P0

1. موافقة على ADR 1–17 (أو تعديلها).
2. **Firebase:** هل لديك مشروع Firebase جاهز، أم نبدأ P0 بدونه (P0 لا يحتاجه)؟
3. **التسمية بالمستودع** (`home-pharmacy`؟) واسم الحزمة.
4. **الدعم الأدنى:** Android Chrome + iOS Safari 16.4+ + Chrome/Edge سطح المكتب؟
5. **مالك الإدارة:** هل صاحب التطبيق شخص واحد (Custom Claim واحد)؟
