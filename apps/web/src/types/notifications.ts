/** Notification types produced by the cron handler (D-05). */
export type NotificationType =
  | 'INCOME_REMINDER'
  | 'PENDING_INCOME_DUE'
  | 'RECURRING_EXPENSE_RECORDED';

/** Shape of a notification row returned by the notification API. */
export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}
