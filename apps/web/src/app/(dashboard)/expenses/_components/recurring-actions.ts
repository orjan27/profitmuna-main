'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';
import type { RecurringExpense, RecurringExpenseListResponse } from '@/types/recurring';
import type { RecurFrequency } from '@/types/recurring';

/** Recurrence + template fields the edit dialog submits (pesos, not cents). */
export interface RecurringExpenseInput {
  categoryId: number;
  /** Decimal pesos — required: auto-record needs an exact amount */
  amountPesos: number;
  description?: string | null;
  walletId: number;
  active?: boolean;
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}

/** All recurring expense templates for the signed-in user. */
export async function fetchRecurringExpensesAction(): Promise<RecurringExpense[]> {
  const res = await apiFetch<RecurringExpenseListResponse>('/api/recurring-expenses');
  return res.data;
}

/**
 * Updates a recurring expense template (schedule, amount, wallet, pause/resume).
 * Amount converts pesos → integer cents here (Pitfall 2).
 */
export async function updateRecurringExpenseAction(
  id: number,
  input: RecurringExpenseInput
): Promise<{ error: string } | void> {
  if (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0) {
    return { error: 'invalid_amount' };
  }

  try {
    await apiFetch(`/api/recurring-expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        categoryId: input.categoryId,
        amount: toCents(input.amountPesos),
        description: input.description ?? null,
        walletId: input.walletId,
        ...(input.active !== undefined && { active: input.active }),
        frequency: input.frequency,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        dayOfMonth2: input.dayOfMonth2 ?? null,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/expenses');
}

/** Pauses or resumes a recurring expense template without touching its schedule. */
export async function setRecurringExpenseActiveAction(
  template: RecurringExpense,
  active: boolean
): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/recurring-expenses/${template.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        active,
        frequency: template.frequency,
        dayOfWeek: template.dayOfWeek,
        dayOfMonth: template.dayOfMonth,
        dayOfMonth2: template.dayOfMonth2,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/expenses');
}

/** Stops (hard-deletes) a recurring expense template. Past entries are untouched. */
export async function deleteRecurringExpenseAction(id: number): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/expenses');
}
