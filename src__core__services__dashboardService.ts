import { addDays, daysBetween, todayString } from '../domain/dates';
import { formatQuantity } from '../domain/stock';
import { appMetaRepository } from '../repositories/appMetaRepository';
import { familyRepository } from '../repositories/familyRepository';
import { healthRepository } from '../repositories/healthRepository';
import { loadCabinet } from './inventoryService';
import { listAppointments, listTasks, type ApptRow, type TaskRow } from './planningService';
import { loadDoses, type DoseRow } from './treatmentService';

export const LAST_BACKUP_KEY = 'lastBackupAt';
export const BACKUP_REMINDER_DAYS = 30;

export interface AlertItem {
  id: string;
  name: string;
  detail?: string;
}

export interface DashboardData {
  hasHousehold: boolean;
  householdName?: string;
  itemCount: number;
  expired: AlertItem[];
  expiringSoon: AlertItem[];
  lowStock: AlertItem[];
  empty: AlertItem[];
  doses: DoseRow[];
  overdueDoses: number;
  appointments: ApptRow[];
  tasks: TaskRow[];
  shoppingPending: number;
  backupReminder?: string;
}

export async function loadDashboard(now: Date = new Date()): Promise<DashboardData> {
  const household = await familyRepository.getHousehold();
  const base: DashboardData = {
    hasHousehold: !!household,
    householdName: household?.name,
    itemCount: 0,
    expired: [],
    expiringSoon: [],
    lowStock: [],
    empty: [],
    doses: [],
    overdueDoses: 0,
    appointments: [],
    tasks: [],
    shoppingPending: 0,
  };
  if (!household) return base;

  const today = todayString(now);
  const weekAhead = addDays(today, 7);

  const [cabinet, doses, appts, tasks, shopping, lastBackup] = await Promise.all([
    loadCabinet(now),
    loadDoses(undefined, now),
    listAppointments(),
    listTasks(),
    healthRepository.listShopping(household.id),
    appMetaRepository.get(LAST_BACKUP_KEY),
  ]);

  const items = cabinet?.items ?? [];
  const toAlert = (i: (typeof items)[number], detail?: string): AlertItem => ({ id: i.id, name: i.tradeName, detail });

  let backupReminder: string | undefined;
  if (!lastBackup) {
    if (items.length > 0) backupReminder = 'لم تحفظ نسخة احتياطية بعد. احفظ نسخة من صفحة النسخ الاحتياطي.';
  } else {
    const days = daysBetween(lastBackup.value.slice(0, 10), today);
    if (days >= BACKUP_REMINDER_DAYS) backupReminder = `آخر نسخة احتياطية منذ ${days} يومًا.`;
  }

  return {
    ...base,
    itemCount: items.length,
    expired: items.filter((i) => i.status === 'expired').map((i) => toAlert(i, i.nearestExpiryText)),
    expiringSoon: items.filter((i) => i.status === 'expiring_soon').map((i) => toAlert(i, i.nearestExpiryText)),
    lowStock: items.filter((i) => i.lowStock).map((i) => toAlert(i, i.qtyText)),
    empty: items.filter((i) => i.status === 'empty').map((i) => toAlert(i)),
    doses,
    overdueDoses: doses.filter((d) => d.state === 'overdue').length,
    appointments: appts.filter((a) => a.status === 'upcoming' && a.date >= today && a.date <= weekAhead),
    tasks: tasks.filter((t) => !t.done && (!t.dueDate || t.dueDate <= weekAhead)),
    shoppingPending: shopping.filter((s) => s.status === 'pending').length,
    backupReminder,
  };
}

export { formatQuantity };
