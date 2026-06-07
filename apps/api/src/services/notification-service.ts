import { and, desc, eq, sql } from 'drizzle-orm';

import { createDb } from '@app/db';
import { notifications } from '@app/db/schema';
import type { z } from 'zod';
import type { notificationQuerySchema } from '@/schemas/notifications';

type ListParams = z.infer<typeof notificationQuerySchema>;

/** Notification type enum — mirrors the DB schema column enum (D-05). */
type NotificationType = 'INCOME_REMINDER' | 'PENDING_INCOME_DUE';

/**
 * Factory for notification service methods.
 *
 * Accepts a raw D1Database binding — same pattern as createSettingsService.
 * Internally creates the Drizzle instance so both route handlers (via
 * createDb(c.env.DB)) and tests (direct d1 binding) work with the same call.
 *
 * All queries are scoped to userId — no IDOR possible (T-6-06, T-6-09).
 *
 * @param d1  D1Database binding
 */
export function createNotificationService(d1: D1Database) {
  const db = createDb(d1);

  return {
    /**
     * Lists notifications for the user, newest-first.
     *
     * @param userId     Authenticated user ID
     * @param params     Query params: unreadOnly (default false), limit (default 50, max 50)
     */
    async list(userId: number, params: ListParams) {
      const rows = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            params.unreadOnly ? eq(notifications.read, false) : undefined
          )
        )
        // Secondary sort by id DESC as tiebreaker for same-millisecond inserts
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(params.limit ?? 50);

      return rows;
    },

    /**
     * Returns the count of unread notifications for the user.
     *
     * @param userId  Authenticated user ID
     */
    async getUnreadCount(userId: number): Promise<number> {
      const rows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

      return Number(rows[0]?.count ?? 0);
    },

    /**
     * Marks a single notification as read.
     *
     * Both `id` AND `userId` are required in the WHERE clause — prevents IDOR
     * (T-6-06, ASVS V4). A wrong userId silently does nothing (no 404 — caller
     * cannot infer another user's notification existence).
     *
     * @param id      Notification ID from URL param
     * @param userId  Authenticated user ID — server-supplied
     */
    async markAsRead(id: number, userId: number): Promise<void> {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    },

    /**
     * Marks all unread notifications as read for the user.
     *
     * @param userId  Authenticated user ID
     */
    async markAllAsRead(userId: number): Promise<void> {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    },

    /**
     * Inserts a notification row for the user. Called by the cron handler (Plan 04).
     *
     * @param userId   Authenticated user ID
     * @param type     Notification type enum value
     * @param title    Short notification title
     * @param message  Notification body text
     * @param link     Optional deep-link URL (D-08)
     */
    async create(
      userId: number,
      type: NotificationType,
      title: string,
      message: string,
      link?: string
    ): Promise<void> {
      await db.insert(notifications).values({
        userId,
        type,
        title,
        message,
        link: link ?? null,
      });
    },
  };
}
