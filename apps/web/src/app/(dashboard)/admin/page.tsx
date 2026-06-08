import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { UserProfile } from '@/types/user';
import type { AdminUser } from '@/types/admin';
import { UsersList } from './_components/users-list';

/**
 * Admin area — user management. Server-guarded: non-admins are redirected to
 * /overview before any admin data is fetched; the API additionally 403s every
 * /api/admin/* call, so the page guard is UX, not the security boundary.
 */
export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  let profile: UserProfile;
  let users: AdminUser[];
  try {
    const me = await apiFetch<{ data: UserProfile }>('/api/auth/me');
    profile = me.data;
    if (profile.role !== 'ADMIN') redirect('/overview');

    const list = await apiFetch<{ data: AdminUser[] }>('/api/admin/users');
    users = list.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/overview');
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-col gap-7">
        <div>
          <h1 className="text-[20px] leading-tight font-semibold">Admin</h1>
          <p className="mt-1.5 text-sm text-ink-faint">
            Manage user accounts and roles. Admins can trigger scheduled jobs from Settings.
          </p>
        </div>

        <UsersList users={users} currentUserId={profile.id} />
      </div>
    </div>
  );
}
