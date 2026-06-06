import { HTTPException } from 'hono/http-exception';
import { eq, and, sql, isNull } from 'drizzle-orm';

import { createDb } from '@app/db';
import { expenseCategories, expenses } from '@app/db/schema';

/** Default expense category names seeded for every new user (D-02). */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Other',
] as const;

export type ExpenseCategoryRecord = typeof expenseCategories.$inferSelect;

/**
 * Lazily seeds the default expense categories for a user if none exist yet.
 * Uses .onConflictDoNothing() on the (userId, name) unique index for race-safety (Pitfall 4).
 */
async function seedDefaultsIfNeeded(
  db: ReturnType<typeof createDb>,
  userId: number
): Promise<void> {
  const existing = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(eq(expenseCategories.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  await db
    .insert(expenseCategories)
    .values(DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name, system: true, userId })))
    .onConflictDoNothing();
}

/**
 * Factory returning the expense category service scoped to a Drizzle db instance.
 * All queries include userId scoping to prevent IDOR (T-02-16).
 */
export function createExpenseCategoryService(db: ReturnType<typeof createDb>) {
  return {
    /**
     * List all expense categories for a user.
     * Seeds defaults on first access if the user has none (D-04).
     */
    async list(userId: number): Promise<ExpenseCategoryRecord[]> {
      await seedDefaultsIfNeeded(db, userId);
      return db.select().from(expenseCategories).where(eq(expenseCategories.userId, userId));
    },

    /**
     * Create a custom expense category (system: false).
     */
    async create(userId: number, name: string): Promise<ExpenseCategoryRecord> {
      const [inserted] = await db
        .insert(expenseCategories)
        .values({ name, system: false, userId })
        .returning();
      return inserted!;
    },

    /**
     * Rename a custom expense category (D-13).
     * Atomically cascades the new name to all existing expenses referencing this category.
     * Throws 404 if not owned; 400 cannot_edit_system_category if system row.
     */
    async update(id: number, userId: number, name: string): Promise<ExpenseCategoryRecord> {
      const existing = await db.query.expenseCategories.findFirst({
        where: and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }
      if (existing.system) {
        throw new HTTPException(400, { message: 'cannot_edit_system_category' });
      }

      // Cascade rename (RESEARCH Pattern 3) — atomic via db.batch so the
      // category row and denormalized expense.categoryName never drift if one
      // statement fails (D-13). Promise.all issues independent, non-atomic
      // statements on D1, which is the bug this batch prevents.
      await db.batch([
        db
          .update(expenseCategories)
          .set({ name })
          .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId))),
        db
          .update(expenses)
          .set({ categoryName: name })
          .where(and(eq(expenses.categoryId, id), eq(expenses.userId, userId))),
      ]);

      const updated = await db.query.expenseCategories.findFirst({
        where: and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)),
      });

      return updated!;
    },

    /**
     * Delete a custom expense category (D-12).
     * Blocked if any expense records reference this category.
     * Throws 404 if not owned; 400 cannot_delete_system_category if system row;
     * 400 category_in_use if referenced by expense records.
     */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.expenseCategories.findFirst({
        where: and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }
      if (existing.system) {
        throw new HTTPException(400, { message: 'cannot_delete_system_category' });
      }

      // Block delete only if an ACTIVE (non-soft-deleted) expense uses this
      // category. Soft-deleted rows are gone from the user's perspective, so
      // they must not block category deletion (D-12, consistent with cascade).
      const [usageRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(expenses)
        .where(
          and(eq(expenses.categoryId, id), eq(expenses.userId, userId), isNull(expenses.deletedAt))
        );

      const count = Number(usageRow?.count ?? 0);
      if (count > 0) {
        throw new HTTPException(400, { message: 'category_in_use' });
      }

      // Soft-deleted expenses still hold a FK to the category, so they must be
      // purged before the category can be hard-deleted. They are already gone
      // from the user's perspective. Batch keeps purge + delete atomic (CR-05).
      await db.batch([
        db.delete(expenses).where(and(eq(expenses.categoryId, id), eq(expenses.userId, userId))),
        db
          .delete(expenseCategories)
          .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId))),
      ]);
    },
  };
}
