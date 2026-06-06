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
}

export interface ExpenseCategoryOption {
  id: number;
  name: string;
  system: boolean;
}

export interface RecordSheetData {
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategoryOption[];
  accounts: SplitAccount[];
}

interface SummaryResponse {
  data: {
    accounts: Array<{
      id: number;
      name: string;
      color: string;
      targetPercentage: number;
    }>;
  };
}

type ActionResult = { ok: true } | { error: string };

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Loads everything the Record sheet needs in one round trip: income and
 * expense categories plus the allocation accounts that drive the live split
 * preview. Called lazily the first time the sheet opens.
 */
export async function getRecordSheetData(): Promise<RecordSheetData> {
  const [incomeCategoriesRes, expenseCategoriesRes, summaryRes] = await Promise.all([
    apiFetch<{ data: IncomeCategory[] }>('/api/income-categories'),
    apiFetch<{ data: ExpenseCategoryOption[] }>('/api/expense-categories'),
    apiFetch<SummaryResponse>('/api/profit-first/summary'),
  ]);

  return {
    incomeCategories: incomeCategoriesRes.data,
    expenseCategories: expenseCategoriesRes.data,
    accounts: summaryRes.data.accounts.map(({ id, name, color, targetPercentage }) => ({
      id,
      name,
      color,
      targetPercentage,
    })),
  };
}

/** Revalidate every surface a money mutation can change. */
function revalidateMoneySurfaces(): void {
  revalidatePath('/overview');
  revalidatePath('/income');
  revalidatePath('/expenses');
  revalidatePath('/profit-first');
  revalidatePath('/wallets');
}

/**
 * Records an income entry from the sheet.
 * Amount arrives as decimal pesos and is converted to integer cents (D-08).
 */
export async function recordIncomeFromSheet(input: {
  categoryId: number;
  /** Decimal pesos from the form input */
  amountPesos: number;
  moneyStatus: 'PENDING' | 'RECEIVED';
  incomeDate: string;
  description?: string;
  expectedReleaseDate?: string;
  profitFirstAllocated: boolean;
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
        profitFirstAllocated: input.profitFirstAllocated,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidateMoneySurfaces();
  return { ok: true };
}

/**
 * Records an expense entry from the sheet.
 * Amount arrives as decimal pesos and is converted to integer cents (D-08).
 */
export async function recordExpenseFromSheet(input: {
  categoryId: number;
  /** Decimal pesos from the form input */
  amountPesos: number;
  expenseDate: string;
  paymentMethod?: string;
  description?: string;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0) {
    return { error: 'invalid_amount' };
  }
  if (!Number.isInteger(input.categoryId) || input.categoryId <= 0) {
    return { error: 'invalid_category' };
  }

  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: input.categoryId,
        amount: toCents(input.amountPesos),
        expenseDate: input.expenseDate,
        paymentMethod: input.paymentMethod || null,
        description: input.description || undefined,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidateMoneySurfaces();
  return { ok: true };
}
