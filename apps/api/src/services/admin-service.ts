import { HTTPException } from 'hono/http-exception';
import { eq, asc } from 'drizzle-orm';

import { createDb } from '@app/db';
import { users, cronRuns } from '@app/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'USER';

/** Admin-facing user row — never exposes passwordHash or token fields. */
export interface AdminUserRecord {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string | null;
}

export interface CronRunRecord {
  job: string;
  ranAt: string;
  trigger: 'SCHEDULED' | 'MANUAL';
  generatedIncomes: number;
  generatedExpenses: number;
  pendingDueNotifications: number;
  reminderEmails: number;
}

// ─── Service factory ──────────────────────────────────────────────────────────

/**
 * Factory for admin-only operations. Routes mount these behind
 * requireAuth + requireAdmin — the service trusts that gate and does not
 * re-check the caller's role (except the self-change guard below).
 */
export function createAdminService(db: ReturnType<typeof createDb>) {
  return {
    /** All users, oldest first. Display fields only — no secrets. */
    async listUsers(): Promise<AdminUserRecord[]> {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(asc(users.id));
      return rows.map((row) => ({ ...row, createdAt: row.createdAt ?? null }));
    },

    /**
     * Changes a user's role. Admins cannot change their OWN role — prevents
     * accidentally locking the last admin out of the admin area.
     */
    async updateUserRole(
      id: number,
      role: UserRole,
      actingUserId: number
    ): Promise<AdminUserRecord> {
      if (id === actingUserId) {
        throw new HTTPException(400, { message: 'cannot_change_own_role' });
      }

      const existing = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: { id: true },
      });
      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      });

      return { ...updated!, createdAt: updated!.createdAt ?? null };
    },

    /** Latest run of the hourly cron job — null before the first run ever. */
    async getLastCronRun(): Promise<CronRunRecord | null> {
      const row = await db.query.cronRuns.findFirst({
        where: eq(cronRuns.job, 'cron'),
      });
      if (!row) return null;
      return {
        job: row.job,
        ranAt: row.ranAt,
        trigger: row.trigger,
        generatedIncomes: row.generatedIncomes,
        generatedExpenses: row.generatedExpenses,
        pendingDueNotifications: row.pendingDueNotifications,
        reminderEmails: row.reminderEmails,
      };
    },
  };
}
