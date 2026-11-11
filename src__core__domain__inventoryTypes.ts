export type PackState = 'sealed' | 'opened' | 'partial' | 'consumed' | 'damaged' | 'quarantined';

export const PACK_STATE_LABELS: Record<PackState, string> = {
  sealed: 'مغلقة',
  opened: 'مفتوحة',
  partial: 'مستهلكة جزئيًا',
  consumed: 'مستهلكة بالكامل',
  damaged: 'تالفة',
  quarantined: 'معزولة للمراجعة',
};

/** الحالات التي يختارها المستخدم عند إضافة تشغيلة. partial/consumed تُشتق من الحركات في P4. "منتهية" تُشتق من التاريخ. */
export const SELECTABLE_PACK_STATES: PackState[] = ['sealed', 'opened', 'damaged', 'quarantined'];

export type TransactionType = 'purchase' | 'dispense' | 'consume' | 'adjust' | 'reversal';
