import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, isNull } from 'drizzle-orm';

import { createDb } from '@app/db';
import { recurringExpenses, expenseCategories, wallets } from '@app/db/schema';

import type { RecurFrequency } from '@/lib/manila-time';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateRecurringExpenseInput {
  categoryId: number;
  /** Integer cents — required: auto-record needs an exact amount */
  amount: number;
  description?: string | null;
  walletId: number;
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
  /** Seeded to the entry date when created alongside a recorded entry */
  lastGeneratedDate?: string | null;
}

export interface UpdateRecurringExpenseInput {
  categoryId?: number;
  amount?: number;
  description?: string | null;
  walletId?: number;
  active?: boolean;
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}

// ─── Response type ────────────────────────────────────────────────────────────

export interface RecurringExpenseRecord {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  walletId: number;
  walletName: string | null;
  frequency: RecurFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  dayOfMonth2: number | null;
  active: boolean;
  lastGeneratedDate: string | null;
  userId: number;
  createdAt: string | null;
  updatedAt: string | null;
}

function toRecord(row: typeof recurringExpenses.$inferSelect): RecurringExpenseRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    description: row.description ?? null,
    walletId: row.walletId,
    walletName: row.walletName ?? null,
    frequency: row.frequency,
    dayOfWeek: row.dayOfWeek ?? null,
    dayOfMonth: row.dayOfMonth ?? null,
    dayOfMonth2: row.dayOfMonth2 ?? null,
    active: !!row.active,
    lastGeneratedDate: row.lastGeneratedDate ?? null,
    userId: row.userId,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/** Same normalization as recurring-income-service: only the frequency's own day fields survive. */
function normalizeDays(input: {
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}): { dayOfWeek: number | null; dayOfMonth: number | null; dayOfMonth2: number | null } {
  return {
    dayOfWeek: input.frequency === 'WEEKLY' ? (input.dayOfWeek ?? null) : null,
    dayOfMonth: input.frequency === 'WEEKLY' ? null : (input.dayOfMonth ?? null),
    dayOfMonth2: input.frequency === 'BIWEEKLY' ? (input.dayOfMonth2 ?? null) : null,
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

/**
 * Factory returning the recurring-expense template CRUD service.
 * All queries include `eq(recurringExpenses.userId, userId)` to prevent IDOR.
 */
export function createRecurringExpenseService(db: ReturnType<typeof createDb>) {
  /** Resolves the wallet name; 400 invalid_wallet if not owned or soft-deleted. */
  async function resolveWalletName(walletId: number, userId: number): Promise<string> {
    const wallet = await db.query.wallets.findFirst({
      where: and(eq(wallets.id, walletId), eq(wallets.userId, userId), isNull(wallets.deletedAt)),
    });
    if (!wallet) {
      throw new HTTPException(400, { message: 'invalid_wallet' });
    }
    return wallet.name;
  }

  return {
    /** All templates for the user (active and paused), newest first. */
    async list(userId: number): Promise<RecurringExpenseRecord[]> {
      const rows = await db
        .select()
        .from(recurringExpenses)
        .where(eq(recurringExpenses.userId, userId))
        .orderBy(desc(recurringExpenses.id));
      return rows.map(toRecord);
    },

    /** Creates a template. Category and wallet ownership validated. */
    async create(
      userId: number,
      input: CreateRecurringExpenseInput
    ): Promise<RecurringExpenseRecord> {
      const category = await db.query.expenseCategories.findFirst({
        where: and(
          eq(expenseCategories.id, input.categoryId),
          eq(expenseCategories.userId, userId)
        ),
      });
      if (!category) {
        throw new HTTPException(400, { message: 'invalid_category' });
      }

      const walletName = await resolveWalletName(input.walletId, userId);

      const [inserted] = await db
        .insert(recurringExpenses)
        .values({
          categoryId: input.categoryId,
          categoryName: category.name,
          amount: input.amount,
          description: input.description ?? null,
          walletId: input.walletId,
          walletName,
          frequency: input.frequency,
          ...normalizeDays(input),
          lastGeneratedDate: input.lastGeneratedDate ?? null,
          userId,
        })
        .returning();

      return toRecord(inserted!);
    },

    /** Updates a template; re-resolves denormalized names when ids change. */
    async update(
      id: number,
      userId: number,
      input: UpdateRecurringExpenseInput
    ): Promise<RecurringExpenseRecord> {
      const existing = await db.query.recurringExpenses.findFirst({
        where: and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)),
      });
      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      let categoryName = existing.categoryName;
      if (input.categoryId !== undefined) {
        const category = await db.query.expenseCategories.findFirst({
          where: and(
            eq(expenseCategories.id, input.categoryId),
            eq(expenseCategories.userId, userId)
          ),
        });
        if (!category) {
          throw new HTTPException(400, { message: 'invalid_category' });
        }
        categoryName = category.name;
      }

      let walletName = existing.walletName;
      if (input.walletId !== undefined) {
        walletName = await resolveWalletName(input.walletId, userId);
      }

      const [updated] = await db
        .update(recurringExpenses)
        .set({
          ...(input.categoryId !== undefined && { categoryId: input.categoryId, categoryName }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.walletId !== undefined && { walletId: input.walletId, walletName }),
          ...(input.active !== undefined && { active: input.active }),
          frequency: input.frequency,
          ...normalizeDays(input),
        })
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
        .returning();

      return toRecord(updated!);
    },

    /** Hard-deletes the owned template (stop). */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.recurringExpenses.findFirst({
        where: and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)),
      });
      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }
      await db
        .delete(recurringExpenses)
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
    },
  };
}
