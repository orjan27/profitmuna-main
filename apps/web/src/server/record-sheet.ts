// Server actions backing the global Record sheet (income + expense quick entry).
// Unlike the /income/new and /expenses/new actions, these do NOT redirect on
// success — the sheet closes in place and the caller refreshes the route.
'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';
import type { IncomeCategory } from '@/types/income';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Allocation account fields needed for the live split preview. */
export interface SplitAccount {
  id: number;
  name: string;
  color: string;
  /** Whole-number percent (e.g. 50 = 50%) — API returns bp/100 */
  targetPercentage: number;
  accountType: 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';
  /** Derived balance in integer cents — drives the expense-form Stella reaction */
  computedBalance: number;
}

export interface ExpenseCategoryOption {
  id: number;
  name: string;
  system: boolean;
}

export interface WalletOption {
  id: number;
  name: string;
}

export interface RecordSheetData {
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategoryOption[];
  accounts: SplitAccount[];
  /** Wallets for the "Paid with" expense selector */
  wallets: WalletOption[];
  /** Default wallet id used to preselect "Paid with" */
  defaultWalletId: number | null;
}

interface SummaryResponse {
  data: {
    accounts: Array<{
      id: number;
      name: string;
      color: string;
      targetPercentage: number;
      accountType: 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';
      computedBalance: number;
    }>;
  };
}

interface WalletsResponse {
  data: Array<{ id: number; name: string; isDefault: boolean }>;
}

type ActionResult = { ok: true } | { ok: true; warning: 'recurrence_failed' } | { error: string };

/** Recurrence schedule submitted alongside an entry (creates a template too). */
export interface RecurrenceInput {
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Loads everything the Record sheet needs in one round trip: income and
 * expense categories plus the allocation accounts that drive the live split
 * preview. Called lazily the first time the sheet opens.
 */
export async function getRecordSheetData(): Promise<RecordSheetData> {
  const [incomeCategoriesRes, expenseCategoriesRes, summaryRes, walletsRes] = await Promise.all([
    apiFetch<{ data: IncomeCategory[] }>('/api/income-categories'),
    apiFetch<{ data: ExpenseCategoryOption[] }>('/api/expense-categories'),
    apiFetch<SummaryResponse>('/api/profit-muna/summary'),
    apiFetch<WalletsResponse>('/api/wallets'),
  ]);

  return {
    incomeCategories: incomeCategoriesRes.data,
    expenseCategories: expenseCategoriesRes.data,
    accounts: summaryRes.data.accounts.map(
      ({ id, name, color, targetPercentage, accountType, computedBalance }) => ({
        id,
        name,
        color,
        targetPercentage,
        accountType,
        computedBalance,
      })
    ),
    wallets: walletsRes.data.map((w) => ({ id: w.id, name: w.name })),
    defaultWalletId: walletsRes.data.find((w) => w.isDefault)?.id ?? null,
  };
}

/** Revalidate every surface a money mutation can change. */
function revalidateMoneySurfaces(): void {
  revalidatePath('/overview');
  revalidatePath('/income');
  revalidatePath('/expenses');
  revalidatePath('/profit-muna');
  revalidatePath('/wallets');
}

/**
 * Records an income entry from the sheet.
 * Amount arrives as decimal pesos and is converted to integer cents (D-08).
 *
 * Optional `recurrence` also creates a recurring template after the entry —
 * lastGeneratedDate is seeded to the entry date so the cron doesn't generate a
 * second entry the same day. Template failure is a soft warning: the recorded
 * entry is never rolled back.
 */
export async function recordIncomeFromSheet(input: {
  categoryId: number;
  /** Decimal pesos from the form input */
  amountPesos: number;
  moneyStatus: 'PENDING' | 'RECEIVED';
  incomeDate: string;
  description?: string;
  expectedReleaseDate?: string;
  profitMunaAllocated: boolean;
  recurrence?: RecurrenceInput;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0) {
    return { error: 'invalid_amount' };
  }
  if (!Number.isInteger(input.categoryId) || input.categoryId <= 0) {
    return { error: 'invalid_category' };
  }

  try {
    await apiFetch('/api/incomes', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: input.categoryId,
        amount: toCents(input.amountPesos),
        description: input.description || undefined,
        incomeDate: input.incomeDate,
        moneyStatus: input.moneyStatus,
        expectedReleaseDate: input.expectedReleaseDate || undefined,
        profitMunaAllocated: input.profitMunaAllocated,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  if (input.recurrence) {
    try {
      await apiFetch('/api/recurring-incomes', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: input.categoryId,
          amount: toCents(input.amountPesos),
          description: input.description || undefined,
          profitMunaAllocated: input.profitMunaAllocated,
          frequency: input.recurrence.frequency,
          dayOfWeek: input.recurrence.dayOfWeek ?? null,
          dayOfMonth: input.recurrence.dayOfMonth ?? null,
          dayOfMonth2: input.recurrence.dayOfMonth2 ?? null,
          // Prevent same-day double generation by the cron
          lastGeneratedDate: input.incomeDate,
        }),
      });
    } catch {
      revalidateMoneySurfaces();
      return { ok: true, warning: 'recurrence_failed' };
    }
  }

  revalidateMoneySurfaces();
  return { ok: true };
}

/**
 * Records an expense entry from the sheet.
 * Amount arrives as decimal pesos and is converted to integer cents (D-08).
 *
 * Optional `recurrence` also creates a recurring template after the entry —
 * same soft-warning semantics as recordIncomeFromSheet.
 */
export async function recordExpenseFromSheet(input: {
  categoryId: number;
  /** Decimal pesos from the form input */
  amountPesos: number;
  expenseDate: string;
  walletId: number;
  description?: string;
  recurrence?: RecurrenceInput;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0) {
    return { error: 'invalid_amount' };
  }
  if (!Number.isInteger(input.categoryId) || input.categoryId <= 0) {
    return { error: 'invalid_category' };
  }
  if (!Number.isInteger(input.walletId) || input.walletId <= 0) {
    return { error: 'invalid_wallet' };
  }

  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: input.categoryId,
        amount: toCents(input.amountPesos),
        expenseDate: input.expenseDate,
        walletId: input.walletId,
        description: input.description || undefined,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  if (input.recurrence) {
    try {
      await apiFetch('/api/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: input.categoryId,
          amount: toCents(input.amountPesos),
          description: input.description || undefined,
          walletId: input.walletId,
          frequency: input.recurrence.frequency,
          dayOfWeek: input.recurrence.dayOfWeek ?? null,
          dayOfMonth: input.recurrence.dayOfMonth ?? null,
          dayOfMonth2: input.recurrence.dayOfMonth2 ?? null,
          // Prevent same-day double generation by the cron
          lastGeneratedDate: input.expenseDate,
        }),
      });
    } catch {
      revalidateMoneySurfaces();
      return { ok: true, warning: 'recurrence_failed' };
    }
  }

  revalidateMoneySurfaces();
  return { ok: true };
}
