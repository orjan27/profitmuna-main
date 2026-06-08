import { and, eq, isNull, ne, or } from 'drizzle-orm';

import { createDb } from '@app/db';
import {
  users,
  incomes,
  expenses,
  wallets,
  recurringIncomes,
  recurringExpenses,
  cronRuns,
} from '@app/db/schema';
import { createEmailService } from '@/lib/email';
import { createNotificationService } from '@/services/notification-service';
import { getManilaParts, scheduleMatchesToday } from '@/lib/manila-time';
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
 * Formats the RECURRING_EXPENSE_RECORDED notification message in the owner's
 * display currency. Honors SET-01: never hardcodes ₱ or 'en-PH'.
 */
function formatRecurringExpenseMessage(
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
  return `${symbol}${formatted} for ${categoryName} was recorded automatically.`;
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

  if (user.reminderFrequency === 'DAILY') return true;

  // WEEKLY/BIWEEKLY/MONTHLY share the day-matching + day-31 clamp logic with
  // recurring income/expense generation (scheduleMatchesToday).
  return scheduleMatchesToday(
    {
      frequency: user.reminderFrequency,
      dayOfWeek: user.reminderDayOfWeek,
      dayOfMonth: user.reminderDayOfMonth,
      dayOfMonth2: user.reminderDayOfMonth2,
    },
    parts
  );
}

/**
 * Sends reminder emails to all users due in the current Manila hour and mirrors
 * each email as an INCOME_REMINDER in-app notification (D-05).
 *
 * Each user is wrapped in a try/catch so one failure does not abort the run (T-6-13).
 *
 * @returns Number of reminder emails sent
 */
async function sendReminderEmails(
  db: ReturnType<typeof createDb>,
  emailSvc: Awaited<ReturnType<typeof createEmailService>>,
  notifSvc: ReturnType<typeof createNotificationService>,
  incomeUrl: string,
  parts: ManilaParts
): Promise<number> {
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

  let sent = 0;
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
      sent += 1;
    } catch (err) {
      // T-6-13: one failure must not abort the remaining due users.
      // Log userId + error only — never email body or API key (T-6-10, security.md).
      console.error('runCron: reminder failed for user', { userId: user.id, err });
    }
  }
  return sent;
}

/**
 * Creates one-time PENDING_INCOME_DUE in-app notifications for pending incomes
 * whose expectedReleaseDate matches today in Manila (D-06, D-07).
 *
 * Never emails (D-06). Dedup guard: isNull(pendingDueNotifiedAt) + stamp after insert (T-6-11).
 * Amount formatted in the income owner's displayCurrency (SET-01).
 *
 * Each income is wrapped in a try/catch so one failure does not abort the run (T-6-13).
 *
 * @returns Number of notifications created
 */
async function createPendingDueNotifications(
  db: ReturnType<typeof createDb>,
  notifSvc: ReturnType<typeof createNotificationService>,
  dateStr: string
): Promise<number> {
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

  let created = 0;
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
      created += 1;
    } catch (err) {
      // T-6-13: one income failure must not abort the rest.
      // Log incomeId + error only — no PII, no email content (T-6-10, security.md).
      console.error('runCron: pending-due notification failed for income', {
        incomeId: income.id,
        err,
      });
    }
  }
  return created;
}

/**
 * Generates income/expense rows from active recurring templates due today
 * (Manila). Dedup guard: lastGeneratedDate stamped to today after generation,
 * so the hourly cron creates at most one entry per template per day.
 *
 * The dedup is part of the SQL WHERE (not just a JS skip): after the first
 * generating run of a Manila day, the remaining ~23 hourly runs fetch zero
 * rows for already-stamped templates instead of fetching-then-skipping.
 *
 * Incomes are generated PENDING with expectedReleaseDate = today — the
 * pending-due step (run after this) picks them up and fires the bell in the
 * same run. Expenses auto-record and notify (RECURRING_EXPENSE_RECORDED).
 *
 * Each template is wrapped in a try/catch so one failure does not abort the run (T-6-13).
 *
 * @returns Counts of generated income and expense rows
 */
async function generateRecurringEntries(
  db: ReturnType<typeof createDb>,
  notifSvc: ReturnType<typeof createNotificationService>,
  parts: ManilaParts
): Promise<{ incomes: number; expenses: number }> {
  let generatedIncomes = 0;
  let generatedExpenses = 0;
  // Fetch-level dedup: skip templates already generated today
  const notGeneratedToday = (
    column: typeof recurringIncomes.lastGeneratedDate | typeof recurringExpenses.lastGeneratedDate
  ) => or(isNull(column), ne(column, parts.dateStr));

  // ── Recurring incomes ──────────────────────────────────────────────────────
  const incomeTemplates = await db
    .select()
    .from(recurringIncomes)
    .where(
      and(eq(recurringIncomes.active, true), notGeneratedToday(recurringIncomes.lastGeneratedDate))
    );

  for (const template of incomeTemplates) {
    if (!scheduleMatchesToday(template, parts)) continue;

    try {
      await db.insert(incomes).values({
        categoryId: template.categoryId,
        categoryName: template.categoryName,
        // null template amount = "amount set on receive" — receive requires it
        amount: template.amount ?? 0,
        description: template.description,
        incomeDate: parts.dateStr,
        moneyStatus: 'PENDING',
        expectedReleaseDate: parts.dateStr,
        receivedDate: null,
        profitFirstAllocated: template.profitFirstAllocated,
        userId: template.userId,
      });
      await db
        .update(recurringIncomes)
        .set({ lastGeneratedDate: parts.dateStr })
        .where(eq(recurringIncomes.id, template.id));
      generatedIncomes += 1;
    } catch (err) {
      // T-6-13: one template failure must not abort the rest. Ids only — no PII.
      console.error('runCron: recurring income generation failed', {
        recurringIncomeId: template.id,
        err,
      });
    }
  }

  // ── Recurring expenses ─────────────────────────────────────────────────────
  // Join users for displayCurrency (SET-01) so the notification formats correctly.
  const expenseTemplates = await db
    .select({
      template: recurringExpenses,
      displayCurrency: users.displayCurrency,
    })
    .from(recurringExpenses)
    .innerJoin(users, eq(recurringExpenses.userId, users.id))
    .where(
      and(
        eq(recurringExpenses.active, true),
        notGeneratedToday(recurringExpenses.lastGeneratedDate)
      )
    );

  for (const { template, displayCurrency } of expenseTemplates) {
    if (!scheduleMatchesToday(template, parts)) continue;

    try {
      // Re-validate the wallet at generation time — skip WITHOUT stamping so a
      // restored wallet resumes generation on a later run.
      const wallet = await db.query.wallets.findFirst({
        where: and(
          eq(wallets.id, template.walletId),
          eq(wallets.userId, template.userId),
          isNull(wallets.deletedAt)
        ),
      });
      if (!wallet) {
        console.error('runCron: wallet missing for recurring expense', {
          recurringExpenseId: template.id,
          walletId: template.walletId,
        });
        continue;
      }

      await db.insert(expenses).values({
        categoryId: template.categoryId,
        categoryName: template.categoryName,
        amount: template.amount,
        description: template.description,
        expenseDate: parts.dateStr,
        walletId: template.walletId,
        walletName: wallet.name,
        deletedAt: null,
        userId: template.userId,
      });
      await db
        .update(recurringExpenses)
        .set({ lastGeneratedDate: parts.dateStr })
        .where(eq(recurringExpenses.id, template.id));

      // Auto-recorded money movement must be visible — in-app only, never emailed
      await notifSvc.create(
        template.userId,
        'RECURRING_EXPENSE_RECORDED',
        'Recurring expense recorded',
        formatRecurringExpenseMessage(template.amount, template.categoryName, displayCurrency),
        '/expenses'
      );
      generatedExpenses += 1;
    } catch (err) {
      console.error('runCron: recurring expense generation failed', {
        recurringExpenseId: template.id,
        err,
      });
    }
  }

  return { incomes: generatedIncomes, expenses: generatedExpenses };
}

// ─── Run tracking ─────────────────────────────────────────────────────────────

export interface CronRunOptions {
  /** Recorded on the cron_runs row — MANUAL for the Settings "Run now" button */
  trigger?: 'SCHEDULED' | 'MANUAL';
  /**
   * Reminder emails are NOT idempotent (no dedup guard) — a manual run during
   * a matching hour would double-send them, so manual triggers skip this step.
   */
  includeReminders?: boolean;
}

export interface CronRunResult {
  ranAt: string;
  trigger: 'SCHEDULED' | 'MANUAL';
  generatedIncomes: number;
  generatedExpenses: number;
  pendingDueNotifications: number;
  reminderEmails: number;
}

/**
 * Main cron handler — called from the `scheduled` export in index.ts, and
 * manually via POST /api/admin/cron/run (trigger MANUAL, reminders skipped).
 *
 * Receives Bindings per-invocation (never at module scope — Pitfall 1).
 * Accepts an optional `now` parameter for test injection (test clock control).
 * Every run overwrites the single cron_runs row (job 'cron') with its result —
 * the Settings "Scheduled Jobs" last-run display reads that row.
 *
 * @param env     Cloudflare Workers Bindings (request-scoped)
 * @param now     Optional override for the current time (default: new Date())
 * @param options Trigger type + whether reminder emails run (see CronRunOptions)
 */
export async function runCron(
  env: Bindings,
  now?: Date,
  options: CronRunOptions = {}
): Promise<CronRunResult> {
  const { trigger = 'SCHEDULED', includeReminders = true } = options;

  // All env values consumed inside runCron — never at module scope (Pitfall 1, T-6-10)
  const db = createDb(env.DB);
  const emailSvc = createEmailService(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  const notifSvc = createNotificationService(env.DB);
  const incomeUrl = `${env.APP_BASE_URL}/income`;

  // Manila time bucketing — NEVER use new Date().getHours() (UTC) (Pitfall 2)
  const parts = getManilaParts(now ?? new Date());

  const reminderEmails = includeReminders
    ? await sendReminderEmails(db, emailSvc, notifSvc, incomeUrl, parts)
    : 0;
  // Generation runs BEFORE pending-due so a same-day generated income's
  // "expected today" bell fires in this run, not the next one.
  const generated = await generateRecurringEntries(db, notifSvc, parts);
  const pendingDueNotifications = await createPendingDueNotifications(db, notifSvc, parts.dateStr);

  const result: CronRunResult = {
    ranAt: (now ?? new Date()).toISOString(),
    trigger,
    generatedIncomes: generated.incomes,
    generatedExpenses: generated.expenses,
    pendingDueNotifications,
    reminderEmails,
  };

  // Single-row-per-job upsert — run tracking must never fail the run itself
  try {
    await db
      .insert(cronRuns)
      .values({ job: 'cron', ...result })
      .onConflictDoUpdate({ target: cronRuns.job, set: result });
  } catch (err) {
    console.error('runCron: failed to record run', { err });
  }

  return result;
}
