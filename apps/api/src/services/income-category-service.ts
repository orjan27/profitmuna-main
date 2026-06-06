import { HTTPException } from 'hono/http-exception';
import { eq, and, sql } from 'drizzle-orm';

import { createDb } from '@app/db';
import { incomeCategories, incomes } from '@app/db/schema';

/** Default income category names seeded for every new user (D-01). */
export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Gifts',
  'Other',
] as const;

export type IncomeCategoryRecord = typeof incomeCategories.$inferSelect;

/**
 * Lazily seeds the default income categories for a user if none exist yet.
 * Uses .onConflictDoNothing() on the (userId, name) unique index for race-safety (Pitfall 4).
 */
async function seedDefaultsIfNeeded(
  db: ReturnType<typeof createDb>,
  userId: number
): Promise<void> {
  const existing = await db
    .select({ id: incomeCategories.id })
    .from(incomeCategories)
    .where(eq(incomeCategories.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  await db
    .insert(incomeCategories)
    .values(DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, system: true, userId })))
    .onConflictDoNothing();
}

/**
 * Factory returning the income category service scoped to a Drizzle db instance.
 * All queries include userId scoping to prevent IDOR (T-02-16).
 */
export function createIncomeCategoryService(db: ReturnType<typeof createDb>) {
  return {
    /**
     * List all income categories for a user.
     * Seeds defaults on first access if the user has none (D-04).
     */
    async list(userId: number): Promise<IncomeCategoryRecord[]> {
      await seedDefaultsIfNeeded(db, userId);
      return db.select().from(incomeCategories).where(eq(incomeCategories.userId, userId));
    },

    /**
     * Create a custom income category (system: false).
     */
    async create(userId: number, name: string): Promise<IncomeCategoryRecord> {
      const [inserted] = await db
        .insert(incomeCategories)
        .values({ name, system: false, userId })
        .returning();
      return inserted!;
    },

    /**
     * Rename a custom income category (D-13).
     * Atomically cascades the new name to all existing incomes referencing this category.
     * Throws 404 if not owned; 400 cannot_edit_system_category if system row.
     */
    async update(id: number, userId: number, name: string): Promise<IncomeCategoryRecord> {
      const existing = await db.query.incomeCategories.findFirst({
        where: and(eq(incomeCategories.id, id), eq(incomeCategories.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }
      if (existing.system) {
        throw new HTTPException(400, { message: 'cannot_edit_system_category' });
      }

      // Cascade rename (RESEARCH Pattern 3) — atomic via db.batch so the
      // category row and denormalized income.categoryName never drift if one
      // statement fails (D-13). Promise.all issues independent, non-atomic
      // statements on D1, which is the bug this batch prevents.
      await db.batch([
        db
          .update(incomeCategories)
          .set({ name })
          .where(and(eq(incomeCategories.id, id), eq(incomeCategories.userId, userId))),
        db
          .update(incomes)
          .set({ categoryName: name })
          .where(and(eq(incomes.categoryId, id), eq(incomes.userId, userId))),
      ]);

      const updated = await db.query.incomeCategories.findFirst({
        where: and(eq(incomeCategories.id, id), eq(incomeCategories.userId, userId)),
      });

      return updated!;
    },

    /**
     * Delete a custom income category (D-12).
     * Blocked if any income records reference this category.
     * Throws 404 if not owned; 400 cannot_delete_system_category if system row;
     * 400 category_in_use if referenced by income records.
     */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.incomeCategories.findFirst({
        where: and(eq(incomeCategories.id, id), eq(incomeCategories.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }
      if (existing.system) {
        throw new HTTPException(400, { message: 'cannot_delete_system_category' });
      }

      // Block delete if any income uses this category (D-12, RESEARCH Pattern 4)
      const [usageRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(incomes)
        .where(and(eq(incomes.categoryId, id), eq(incomes.userId, userId)));

      const count = Number(usageRow?.count ?? 0);
      if (count > 0) {
        throw new HTTPException(400, { message: 'category_in_use' });
      }

      await db
        .delete(incomeCategories)
        .where(and(eq(incomeCategories.id, id), eq(incomeCategories.userId, userId)));
    },
  };
}
