import { eq, and, desc, isNull, gte, lte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import { expenses, expenseCategories } from '@app/db/schema';

type Db = ReturnType<typeof createDb>;

interface ExpenseRow {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  paymentMethod: string | null;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  userId: number;
}

interface ExpenseResponse {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  paymentMethod: string | null;
  deletedAt: string | null;
  createdAt: string | null;
}

interface PaginatedExpenses {
  content: ExpenseResponse[];
  page: number;
  last: boolean;
  totalElements: number;
}

interface CreateExpenseInput {
  categoryId: number;
  amount: number;
  description?: string | null;
  expenseDate: string;
  paymentMethod?: string | null;
}

interface UpdateExpenseInput {
  categoryId?: number;
  amount?: number;
  description?: string | null;
  expenseDate?: string;
  paymentMethod?: string | null;
}

interface ListParams {
  page: number;
  limit: number;
  from?: string;
  to?: string;
}

function toResponse(row: ExpenseRow): ExpenseResponse {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    description: row.description,
    expenseDate: row.expenseDate,
    paymentMethod: row.paymentMethod,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Validates that categoryId is owned by userId.
 * Throws HTTPException 400 invalid_category if not found.
 */
async function resolveCategoryName(db: Db, categoryId: number, userId: number): Promise<string> {
  const category = await db.query.expenseCategories.findFirst({
    where: and(eq(expenseCategories.id, categoryId), eq(expenseCategories.userId, userId)),
  });

  if (!category) {
    throw new HTTPException(400, { message: 'invalid_category' });
  }

  return category.name;
}

/**
 * Factory that creates the expense service for a given DB instance.
 * All queries are scoped to userId; cross-user access returns 404.
 */
export function createExpenseService(db: Db) {
  return {
    /**
     * Lists expenses for a user with optional date range filter.
     * Includes soft-deleted rows (with deletedAt set) so the UI can display + restore them.
     * Active totals must use isNull(deletedAt).
     */
    async list(userId: number, params: ListParams): Promise<PaginatedExpenses> {
      const { page, limit, from, to } = params;

      const conditions = [eq(expenses.userId, userId)];
      if (from) conditions.push(gte(expenses.expenseDate, from));
      if (to) conditions.push(lte(expenses.expenseDate, to));

      const whereClause = and(...conditions);

      const rows = await db
        .select()
        .from(expenses)
        .where(whereClause)
        .orderBy(desc(expenses.expenseDate))
        .limit(limit + 1) // fetch one extra to determine if there's a next page
        .offset(page * limit);

      const hasMore = rows.length > limit;
      const content = (hasMore ? rows.slice(0, limit) : rows).map(toResponse);

      // Count total for pagination metadata (active + deleted)
      const allRows = await db.select({ id: expenses.id }).from(expenses).where(whereClause);
      const totalElements = allRows.length;

      return {
        content,
        page,
        last: !hasMore,
        totalElements,
      };
    },

    /** Creates an expense for a user. amount is integer cents from the web layer. */
    async create(userId: number, input: CreateExpenseInput): Promise<ExpenseResponse> {
      const categoryName = await resolveCategoryName(db, input.categoryId, userId);

      const [row] = await db
        .insert(expenses)
        .values({
          categoryId: input.categoryId,
          categoryName,
          amount: input.amount,
          description: input.description ?? null,
          expenseDate: input.expenseDate,
          paymentMethod: input.paymentMethod ?? null,
          userId,
          deletedAt: null,
        })
        .returning();

      return toResponse(row as ExpenseRow);
    },

    /** Gets a single expense by id, scoped to userId. 404 if not owned. */
    async getById(id: number, userId: number): Promise<ExpenseResponse> {
      const row = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      });

      if (!row) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      return toResponse(row as ExpenseRow);
    },

    /** Updates an owned expense; re-resolves categoryName if categoryId changes. 404 if not owned. */
    async update(id: number, userId: number, input: UpdateExpenseInput): Promise<ExpenseResponse> {
      const existing = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      // A soft-deleted expense must be restored before it can be edited —
      // editing it directly would bypass the soft-delete state machine (CR-05).
      if (existing.deletedAt) {
        throw new HTTPException(409, { message: 'expense_deleted' });
      }

      let categoryName = existing.categoryName;
      if (input.categoryId !== undefined) {
        categoryName = await resolveCategoryName(db, input.categoryId, userId);
      }

      const [updated] = await db
        .update(expenses)
        .set({
          ...(input.categoryId !== undefined && { categoryId: input.categoryId, categoryName }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.expenseDate !== undefined && { expenseDate: input.expenseDate }),
          ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
        })
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning();

      return toResponse(updated as ExpenseRow);
    },

    /**
     * Soft-deletes an expense by setting deletedAt to the current ISO timestamp.
     * 404 if the expense is not owned by userId (T-02-10 IDOR mitigation).
     */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      await db
        .update(expenses)
        .set({ deletedAt: new Date().toISOString() })
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    },

    /**
     * Restores a soft-deleted expense by clearing deletedAt.
     * 404 if the expense is not owned by userId (T-02-10 IDOR mitigation).
     */
    async restore(id: number, userId: number): Promise<ExpenseResponse> {
      const existing = await db.query.expenses.findFirst({
        where: and(eq(expenses.id, id), eq(expenses.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      const [updated] = await db
        .update(expenses)
        .set({ deletedAt: null })
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning();

      return toResponse(updated as ExpenseRow);
    },

    /**
     * Computes the total active (non-deleted) expense amount for a userId
     * with optional date range. Uses isNull(expenses.deletedAt) for correctness (T-02-14).
     */
    async totalActive(
      userId: number,
      params: { from?: string; to?: string } = {}
    ): Promise<number> {
      const conditions = [eq(expenses.userId, userId), isNull(expenses.deletedAt)];
      if (params.from) conditions.push(gte(expenses.expenseDate, params.from));
      if (params.to) conditions.push(lte(expenses.expenseDate, params.to));

      const rows = await db
        .select({ amount: expenses.amount })
        .from(expenses)
        .where(and(...conditions));

      return rows.reduce((sum, r) => sum + r.amount, 0);
    },
  };
}
