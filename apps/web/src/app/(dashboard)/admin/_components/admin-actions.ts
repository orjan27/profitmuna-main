'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import type { CronRun } from '@/types/admin';

/** Changes a user's role (ADMIN ↔ USER). The API rejects changing your own role. */
export async function updateUserRoleAction(
  id: number,
  role: 'ADMIN' | 'USER'
): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/admin');
}

/**
 * Manually triggers the cron's idempotent steps (recurring generation +
 * due-income bells) for all users. Reminder emails are skipped server-side.
 */
export async function runCronNowAction(): Promise<{ data: CronRun } | { error: string }> {
  try {
    const res = await apiFetch<{ data: CronRun }>('/api/admin/cron/run', { method: 'POST' });
    revalidatePath('/settings');
    return { data: res.data };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
}
