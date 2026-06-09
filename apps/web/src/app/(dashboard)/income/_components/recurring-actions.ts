'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';
import type { RecurringIncome, RecurringIncomeListResponse } from '@/types/recurring';
import type { RecurFrequency } from '@/types/recurring';

/** Recurrence + template fields the edit dialog submits (pesos, not cents). */
export interface RecurringIncomeInput {
  categoryId: number;
  /** Decimal pesos; undefined = "amount set on receive" */
  amountPesos?: number;
  description?: string | null;
  profitMunaAllocated?: boolean;
  active?: boolean;
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}

/** All recurring income templates for the signed-in user. */
export async function fetchRecurringIncomesAction(): Promise<RecurringIncome[]> {
  const res = await apiFetch<RecurringIncomeListResponse>('/api/recurring-incomes');
  return res.data;
}

/**
 * Updates a recurring income template (schedule, amount, pause/resume).
 * Amount converts pesos → integer cents here (Pitfall 2).
 */
export async function updateRecurringIncomeAction(
  id: number,
  input: RecurringIncomeInput
): Promise<{ error: string } | void> {
  if (
    input.amountPesos !== undefined &&
    (!Number.isFinite(input.amountPesos) || input.amountPesos <= 0)
  ) {
    return { error: 'invalid_amount' };
  }

  try {
    await apiFetch(`/api/recurring-incomes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        categoryId: input.categoryId,
        amount: input.amountPesos !== undefined ? toCents(input.amountPesos) : null,
        description: input.description ?? null,
        ...(input.profitMunaAllocated !== undefined && {
          profitMunaAllocated: input.profitMunaAllocated,
        }),
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

  revalidatePath('/income');
}

/** Pauses or resumes a recurring income template without touching its schedule. */
export async function setRecurringIncomeActiveAction(
  template: RecurringIncome,
  active: boolean
): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/recurring-incomes/${template.id}`, {
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

  revalidatePath('/income');
}

/** Stops (hard-deletes) a recurring income template. Past entries are untouched. */
export async function deleteRecurringIncomeAction(id: number): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/recurring-incomes/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/income');
}
