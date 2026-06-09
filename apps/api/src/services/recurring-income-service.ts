import { HTTPException } from 'hono/http-exception';
import { eq, and, desc } from 'drizzle-orm';

import { createDb } from '@app/db';
import { recurringIncomes, incomeCategories } from '@app/db/schema';

import type { RecurFrequency } from '@/lib/manila-time';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateRecurringIncomeInput {
  categoryId: number;
  /** Integer cents; null = "amount set on receive" */
  amount?: number | null;
  description?: string | null;
  profitMunaAllocated?: boolean;
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
  /** Seeded to the entry date when created alongside a recorded entry */
  lastGeneratedDate?: string | null;
}

export interface UpdateRecurringIncomeInput {
  categoryId?: number;
  amount?: number | null;
  description?: string | null;
  profitMunaAllocated?: boolean;
  active?: boolean;
  frequency: RecurFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}

// ─── Response type ────────────────────────────────────────────────────────────

export interface RecurringIncomeRecord {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number | null;
  description: string | null;
  frequency: RecurFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  dayOfMonth2: number | null;
  profitMunaAllocated: boolean;
  active: boolean;
  lastGeneratedDate: string | null;
  userId: number;
  createdAt: string | null;
  updatedAt: string | null;
}

function toRecord(row: typeof recurringIncomes.$inferSelect): RecurringIncomeRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount ?? null,
    description: row.description ?? null,
    frequency: row.frequency,
    dayOfWeek: row.dayOfWeek ?? null,
    dayOfMonth: row.dayOfMonth ?? null,
    dayOfMonth2: row.dayOfMonth2 ?? null,
    profitMunaAllocated: !!row.profitMunaAllocated,
    active: !!row.active,
    lastGeneratedDate: row.lastGeneratedDate ?? null,
    userId: row.userId,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/**
 * Normalizes day fields so the stored row carries exactly the columns its
 * frequency needs — the rest are nulled. Keeps scheduleMatchesToday and the
 * management UI summary unambiguous.
 */
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
 * Factory returning the recurring-income template CRUD service.
 * All queries include `eq(recurringIncomes.userId, userId)` to prevent IDOR.
 */
export function createRecurringIncomeService(db: ReturnType<typeof createDb>) {
  return {
    /** All templates for the user (active and paused), newest first. */
    async list(userId: number): Promise<RecurringIncomeRecord[]> {
      const rows = await db
        .select()
        .from(recurringIncomes)
        .where(eq(recurringIncomes.userId, userId))
        .orderBy(desc(recurringIncomes.id));
      return rows.map(toRecord);
    },

    /** Creates a template. Category ownership validated (T-02-07 pattern). */
    async create(
      userId: number,
      input: CreateRecurringIncomeInput
    ): Promise<RecurringIncomeRecord> {
      const category = await db.query.incomeCategories.findFirst({
        where: and(eq(incomeCategories.id, input.categoryId), eq(incomeCategories.userId, userId)),
      });
      if (!category) {
        throw new HTTPException(400, { message: 'invalid_category' });
      }

      const [inserted] = await db
        .insert(recurringIncomes)
        .values({
          categoryId: input.categoryId,
          categoryName: category.name,
          amount: input.amount ?? null,
          description: input.description ?? null,
          frequency: input.frequency,
          ...normalizeDays(input),
          profitMunaAllocated: input.profitMunaAllocated ?? true,
          lastGeneratedDate: input.lastGeneratedDate ?? null,
          userId,
        })
        .returning();

      return toRecord(inserted!);
    },

    /** Updates a template; re-resolves categoryName when categoryId changes. */
    async update(
      id: number,
      userId: number,
      input: UpdateRecurringIncomeInput
    ): Promise<RecurringIncomeRecord> {
      const existing = await db.query.recurringIncomes.findFirst({
        where: and(eq(recurringIncomes.id, id), eq(recurringIncomes.userId, userId)),
      });
      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      let categoryName = existing.categoryName;
      if (input.categoryId !== undefined) {
        const category = await db.query.incomeCategories.findFirst({
          where: and(
            eq(incomeCategories.id, input.categoryId),
            eq(incomeCategories.userId, userId)
          ),
        });
        if (!category) {
          throw new HTTPException(400, { message: 'invalid_category' });
        }
        categoryName = category.name;
      }

      const [updated] = await db
        .update(recurringIncomes)
        .set({
          ...(input.categoryId !== undefined && { categoryId: input.categoryId, categoryName }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.profitMunaAllocated !== undefined && {
            profitMunaAllocated: input.profitMunaAllocated,
          }),
          ...(input.active !== undefined && { active: input.active }),
          frequency: input.frequency,
          ...normalizeDays(input),
        })
        .where(and(eq(recurringIncomes.id, id), eq(recurringIncomes.userId, userId)))
        .returning();

      return toRecord(updated!);
    },

    /** Hard-deletes the owned template (stop). */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.recurringIncomes.findFirst({
        where: and(eq(recurringIncomes.id, id), eq(recurringIncomes.userId, userId)),
      });
      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }
      await db
        .delete(recurringIncomes)
        .where(and(eq(recurringIncomes.id, id), eq(recurringIncomes.userId, userId)));
    },
  };
}
