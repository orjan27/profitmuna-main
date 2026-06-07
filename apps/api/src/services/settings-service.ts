import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import { users } from '@app/db/schema';
import type { z } from 'zod';
import type { updateSettingsSchema } from '@/schemas/settings';

type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Factory for settings service methods.
 *
 * Accepts the raw D1 binding object (matches what the test helper passes:
 * `{ DB: d1 }`). This keeps the service testable without a full Hono context.
 *
 * All queries are scoped to the authenticated userId — no IDOR possible (T-6-03).
 *
 * @param env  Object with a `DB` D1Database binding
 */
export function createSettingsService(env: { DB: D1Database }) {
  const db = createDb(env.DB);

  return {
    /**
     * Returns the seven settings columns for the user.
     *
     * @param userId  Authenticated user ID — always server-supplied
     * @throws HTTPException 404 if no user row found
     */
    async getSettings(userId: number) {
      const rows = await db
        .select({
          displayCurrency: users.displayCurrency,
          reminderEnabled: users.reminderEnabled,
          reminderFrequency: users.reminderFrequency,
          reminderDayOfWeek: users.reminderDayOfWeek,
          reminderDayOfMonth: users.reminderDayOfMonth,
          reminderDayOfMonth2: users.reminderDayOfMonth2,
          reminderHour: users.reminderHour,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });
      return rows[0];
    },

    /**
     * Persists the provided settings fields for the user, then returns the
     * updated settings row. Ownership-scoped: only the calling user's row is
     * ever touched.
     *
     * @param userId  Authenticated user ID — always server-supplied
     * @param input   Partial settings update (all fields optional)
     */
    async updateSettings(userId: number, input: UpdateSettingsInput) {
      // Ownership-scoped update — same pattern as wallet-service update()
      await db.update(users).set(input).where(eq(users.id, userId));
      return this.getSettings(userId);
    },
  };
}
