'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/format-date';
import type { AdminUser } from '@/types/admin';
import { updateUserRoleAction } from './admin-actions';

interface UsersListProps {
  users: AdminUser[];
  /** The signed-in admin — their own role select is disabled (API rejects it too) */
  currentUserId: number;
}

/**
 * "Users" section of the Admin page: every account with a role selector.
 * Changing a role saves immediately; your own row is locked so the last
 * admin can't demote themselves out of the admin area.
 */
export function UsersList({ users, currentUserId }: UsersListProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(user: AdminUser, role: 'ADMIN' | 'USER') {
    if (role === user.role) return;
    startTransition(async () => {
      const result = await updateUserRoleAction(user.id, role);
      if (result?.error) {
        toast.error(
          result.error === 'cannot_change_own_role'
            ? 'You cannot change your own role.'
            : 'Could not update the role. Please try again.'
        );
        return;
      }
      toast.success(`${user.name} is now ${role === 'ADMIN' ? 'an Admin' : 'a User'}.`);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="admin-users-heading" className="flex flex-col gap-2">
      <h2
        id="admin-users-heading"
        className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase"
      >
        Users
      </h2>
      <ul className="divide-y divide-hairline/60">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <li key={user.id} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name}
                  {isSelf ? (
                    <span className="ml-2 text-xs font-normal text-ink-faint">You</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">
                  {user.email}
                  {user.createdAt ? ` · joined ${formatDate(user.createdAt)}` : ''}
                </p>
              </div>
              <Select
                value={user.role}
                onValueChange={(v) => handleRoleChange(user, v as 'ADMIN' | 'USER')}
                disabled={isSelf || isPending}
              >
                <SelectTrigger className="w-28 shrink-0" aria-label={`Role for ${user.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
