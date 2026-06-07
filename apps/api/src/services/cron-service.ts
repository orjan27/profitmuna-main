import { and, eq, isNull } from 'drizzle-orm';

import { createDb } from '@app/db';
import { users, incomes } from '@app/db/schema';
import { createEmailService } from '@/lib/email';
import { createNotificationService } from '@/services/notification-service';
import { getManilaParts, lastDayOfMonth } from '@/lib/manila-time';
import type { Bindings } from '@/types';
import type { ManilaParts } from '@/lib/manila-time';

/**
 * Inline currency locale map for notification copy.
 *
 * NOTE: Keep in sync with CURRENCY_LOCALES in apps/web/src/lib/format-currency.ts.
 * The API layer cannot import from apps/web across the workspace boundary, so this
 * map is intentionally duplicated here. If you add a currency to format-currency.ts,
 * add it here too (and vice versa).
 */
const CRON_CURRENCY_LOCALES: Record<string, { locale: string; symbol: string }> = {
  PHP: { locale: 'en-PH', symbol: '₱' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  SGD: { locale: 'en-SG', symbol: 'S$' },
  AUD: { locale: 'en-AU', symbol: 'A$' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  CAD: { locale: 'en-CA', symbol: 'C$' },
};

/**
 * Formats the PENDING_INCOME_DUE notification message in the income owner's display currency.
 * Honors SET-01: never hardcodes ₱ or 'en-PH'.
 */
function formatPendingDueMessage(
  amountCents: number,
  categoryName: string,
  currency: string
): string {
  const { locale, symbol } = CRON_CURRENCY_LOCALES[currency] ?? CRON_CURRENCY_LOCALES['PHP'];
  const fractionDigits = currency === 'JPY' ? 0 : 2;
  const formatted = (amountCents / 100).toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${symbol}${formatted} from ${categoryName} was expected today — mark it as received?`;
}

/**
 * Returns true if the given user's reminder schedule matches the current Manila time parts.
 *
 * Rules:
 * - reminderEnabled must be true
 * - DAILY: reminderHour matches
 * - WEEKLY: reminderDayOfWeek matches AND reminderHour matches
 * - BIWEEKLY: reminderDayOfMonth OR reminderDayOfMonth2 matches (with day-31 clamp) AND reminderHour matches
 * - MONTHLY: reminderDayOfMonth matches (with day-31 clamp) AND reminderHour matches
 */
function isUserDue(
  user: {
    reminderEnabled: boolean;
    reminderFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
    reminderHour: number | null;
    reminderDayOfWeek: number | null;
    reminderDayOfMonth: number | null;
    reminderDayOfMonth2: number | null;
  },
  parts: ManilaParts
): boolean {
  if (!user.reminderEnabled) return false;
  if (user.reminderFrequency === null || user.reminderHour === null) return false;
  if (user.reminderHour !== parts.hour) return false;

  // Pitfall 6: clamp day > last day of this month (e.g. stored 31, month has 28)
  const clampToMonth = (day: number): number => {
    const manilaDate = new Date(parts.dateStr + 'T00:00:00Z');
    const year = manilaDate.getUTCFullYear();
    const month0 = manilaDate.getUTCMonth();
    return Math.min(day, lastDayOfMonth(year, month0));
  };

  switch (user.reminderFrequency) {
    case 'DAILY':
      return true;

    case 'WEEKLY':
      return user.reminderDayOfWeek === parts.dayOfWeek;

    case 'BIWEEKLY': {
      // Twice a month: due when either configured day matches today
      if (user.reminderDayOfMonth === null || user.reminderDayOfMonth2 === null) return false;
      return (
        clampToMonth(user.reminderDayOfMonth) === parts.dayOfMonth ||
        clampToMonth(user.reminderDayOfMonth2) === parts.dayOfMonth
      );
    }

    case 'MONTHLY': {
      if (user.reminderDayOfMonth === null) return false;
      return clampToMonth(user.reminderDayOfMonth) === parts.dayOfMonth;
    }

    default:
      return false;
  }
}

/**
 * Sends reminder emails to all users due in the current Manila hour and mirrors
 * each email as an INCOME_REMINDER in-app notification (D-05).
 *
 * Each user is wrapped in a try/catch so one failure does not abort the run (T-6-13).
 */
async function sendReminderEmails(
  db: ReturnType<typeof createDb>,
  emailSvc: Awaited<ReturnType<typeof createEmailService>>,
  notifSvc: ReturnType<typeof createNotificationService>,
  incomeUrl: string,
  parts: ManilaParts
): Promise<void> {
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      reminderEnabled: users.reminderEnabled,
      reminderFrequency: users.reminderFrequency,
      reminderHour: users.reminderHour,
      reminderDayOfWeek: users.reminderDayOfWeek,
      reminderDayOfMonth: users.reminderDayOfMonth,
      reminderDayOfMonth2: users.reminderDayOfMonth2,
    })
    .from(users)
    .where(eq(users.reminderEnabled, true));

  for (const user of allUsers) {
    if (!isUserDue(user, parts)) continue;

    try {
      // D-04: simple nudge email + link to income page
      await emailSvc.sendIncomeReminderEmail(user.email, user.name, incomeUrl);
      // D-05: mirror as in-app INCOME_REMINDER notification
      await notifSvc.create(
        user.id,
        'INCOME_REMINDER',
        'Time to log your income',
        "Don't forget to record any income you received.",
        '/income'
      );
    } catch (err) {
      // T-6-13: one failure must not abort the remaining due users.
      // Log userId + error only — never email body or API key (T-6-10, security.md).
      console.error('runCron: reminder failed for user', { userId: user.id, err });
    }
  }
}

/**
 * Creates one-time PENDING_INCOME_DUE in-app notifications for pending incomes
 * whose expectedReleaseDate matches today in Manila (D-06, D-07).
 *
 * Never emails (D-06). Dedup guard: isNull(pendingDueNotifiedAt) + stamp after insert (T-6-11).
 * Amount formatted in the income owner's displayCurrency (SET-01).
 *
 * Each income is wrapped in a try/catch so one failure does not abort the run (T-6-13).
 */
async function createPendingDueNotifications(
  db: ReturnType<typeof createDb>,
  notifSvc: ReturnType<typeof createNotificationService>,
  dateStr: string
): Promise<void> {
  // Join incomes with users to get the owner's displayCurrency (SET-01)
  const dueIncomes = await db
    .select({
      id: incomes.id,
      userId: incomes.userId,
      amount: incomes.amount,
      categoryName: incomes.categoryName,
      displayCurrency: users.displayCurrency,
    })
    .from(incomes)
    .innerJoin(users, eq(incomes.userId, users.id))
    .where(
      and(
        eq(incomes.moneyStatus, 'PENDING'),
        eq(incomes.expectedReleaseDate, dateStr),
        isNull(incomes.pendingDueNotifiedAt) // D-07 dedup guard
      )
    );

  for (const income of dueIncomes) {
    try {
      // D-06: in-app only, never emailed
      await notifSvc.create(
        income.userId,
        'PENDING_INCOME_DUE',
        'Income expected today',
        formatPendingDueMessage(income.amount, income.categoryName, income.displayCurrency),
        '/income'
      );
      // Stamp dedup column immediately after insert (T-6-11)
      await db
        .update(incomes)
        .set({ pendingDueNotifiedAt: new Date().toISOString() })
        .where(eq(incomes.id, income.id));
    } catch (err) {
      // T-6-13: one income failure must not abort the rest.
      // Log incomeId + error only — no PII, no email content (T-6-10, security.md).
      console.error('runCron: pending-due notification failed for income', {
        incomeId: income.id,
        err,
      });
    }
  }
}

/**
 * Main cron handler — called from the `scheduled` export in index.ts.
 *
 * Receives Bindings per-invocation (never at module scope — Pitfall 1).
 * Accepts an optional `now` parameter for test injection (test clock control).
 *
 * @param env  Cloudflare Workers Bindings (request-scoped)
 * @param now  Optional override for the current time (default: new Date())
 */
export async function runCron(env: Bindings, now?: Date): Promise<void> {
  // All env values consumed inside runCron — never at module scope (Pitfall 1, T-6-10)
  const db = createDb(env.DB);
  const emailSvc = createEmailService(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  const notifSvc = createNotificationService(env.DB);
  const incomeUrl = `${env.APP_BASE_URL}/income`;

  // Manila time bucketing — NEVER use new Date().getHours() (UTC) (Pitfall 2)
  const parts = getManilaParts(now ?? new Date());

  await sendReminderEmails(db, emailSvc, notifSvc, incomeUrl, parts);
  await createPendingDueNotifications(db, notifSvc, parts.dateStr);
}
