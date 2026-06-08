/** Admin-facing user row from GET /api/admin/users — display fields only. */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  emailVerified: boolean;
  createdAt: string | null;
}

/** Latest cron run from GET /api/admin/cron/last-run — null before the first run. */
export interface CronRun {
  job: string;
  /** ISO datetime of the run */
  ranAt: string;
  trigger: 'SCHEDULED' | 'MANUAL';
  generatedIncomes: number;
  generatedExpenses: number;
  pendingDueNotifications: number;
  reminderEmails: number;
}
