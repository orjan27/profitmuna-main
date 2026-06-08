import { eq, and, desc, isNull, gte, lte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import { expenses, expenseCategories, wallets } from '@app/db/schema';

type Db = ReturnType<typeof createDb>;

interface ExpenseRow {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  walletId: number | null;
  walletName: string | null;
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
  walletId: number | null;
  walletName: string | null;
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
  walletId: number;
}

interface UpdateExpenseInput {
  categoryId?: number;
  amount?: number;
  description?: string | null;
  expenseDate?: string;
  walletId?: number;
}

interface ListParams {
  page: number;
  limit: number;
  from?: string;
  to?: string;
}

/**
 * Inputs for the expense analytics aggregate. Date math (period bounds and the
 * YYYY[-MM] keys) is resolved Asia/Manila-side in the web layer and passed down
 * as concrete strings, keeping this service timezone-agnostic.
 */
export interface ExpenseStatsParams {
  from?: string;
  to?: string;
  /** Calendar year for the monthly bar series, `YYYY`. */
  year: string;
  /** Current calendar month, `YYYY-MM`. */
  month: string;
  /** Previous calendar month, `YYYY-MM`. */
  prevMonth: string;
}

/** Aggregate figures backing the expense analytics band and charts. */
export interface ExpenseStats {
  /** Total + record count within the active period (active rows only). */
  period: { total: number; count: number };
  thisMonthTotal: number;
  prevMonthTotal: number;
  /** Highest single calendar month all-time, or null when there are no records. */
  bestMonth: { ym: string; total: number } | null;
  monthly: { ym: string; total: number }[];
  bySource: { categoryName: string; total: number; count: number }[];
}

function toResponse(row: ExpenseRow): ExpenseResponse {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    description: row.description,
    expenseDate: row.expenseDate,
    walletId: row.walletId,
    walletName: row.walletName,
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
 * Validates that walletId is owned by userId and not soft-deleted.
 * Returns the wallet name to denormalize onto the expense. Mirrors resolveCategoryName.
 * Throws HTTPException 400 invalid_wallet if not found, not owned, or soft-deleted.
 */
async function resolveWalletName(db: Db, walletId: number, userId: number): Promise<string> {
  const wallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.id, walletId), eq(wallets.userId, userId), isNull(wallets.deletedAt)),
  });

  if (!wallet) {
    throw new HTTPException(400, { message: 'invalid_wallet' });
  }

  return wallet.name;
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

    /**
     * Analytics aggregate for the expense ledger. Mirrors the income stats but
     * counts ACTIVE (non-soft-deleted) rows only, so restored/deleted expenses
     * never skew the figures or charts.
     */
    async stats(userId: number, params: ExpenseStatsParams): Promise<ExpenseStats> {
      const { from, to, year, month, prevMonth } = params;
      const active = isNull(expenses.deletedAt);
      const ym = sql<string>`substr(${expenses.expenseDate}, 1, 7)`;

      const periodConds = [eq(expenses.userId, userId), active];
      if (from) periodConds.push(gte(expenses.expenseDate, from));
      if (to) periodConds.push(lte(expenses.expenseDate, to));

      const [periodRow] = await db
        .select({
          total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(expenses)
        .where(and(...periodConds));

      const bySourceRows = await db
        .select({
          categoryName: expenses.categoryName,
          total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(expenses)
        .where(and(...periodConds))
        .groupBy(expenses.categoryName)
        .orderBy(desc(sql`sum(${expenses.amount})`));

      const monthlyRows = await db
        .select({ ym, total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            active,
            sql`substr(${expenses.expenseDate}, 1, 4) = ${year}`
          )
        )
        .groupBy(ym)
        .orderBy(ym);

      const [bestRow] = await db
        .select({ ym, total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(eq(expenses.userId, userId), active))
        .groupBy(ym)
        .orderBy(desc(sql`sum(${expenses.amount})`))
        .limit(1);

      const monthTotal = async (key: string): Promise<number> => {
        const [row] = await db
          .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
          .from(expenses)
          .where(
            and(
              eq(expenses.userId, userId),
              active,
              sql`substr(${expenses.expenseDate}, 1, 7) = ${key}`
            )
          );
        return Number(row?.total ?? 0);
      };

      return {
        period: { total: Number(periodRow?.total ?? 0), count: Number(periodRow?.count ?? 0) },
        thisMonthTotal: await monthTotal(month),
        prevMonthTotal: await monthTotal(prevMonth),
        bestMonth: bestRow ? { ym: bestRow.ym, total: Number(bestRow.total) } : null,
        monthly: monthlyRows.map((r) => ({ ym: r.ym, total: Number(r.total) })),
        bySource: bySourceRows.map((r) => ({
          categoryName: r.categoryName,
          total: Number(r.total),
          count: Number(r.count),
        })),
      };
    },

    /** Creates an expense for a user. amount is integer cents from the web layer. */
    async create(userId: number, input: CreateExpenseInput): Promise<ExpenseResponse> {
      const categoryName = await resolveCategoryName(db, input.categoryId, userId);
      const walletName = await resolveWalletName(db, input.walletId, userId);

      const [row] = await db
        .insert(expenses)
        .values({
          categoryId: input.categoryId,
          categoryName,
          amount: input.amount,
          description: input.description ?? null,
          expenseDate: input.expenseDate,
          walletId: input.walletId,
          walletName,
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

      let walletName = existing.walletName;
      if (input.walletId !== undefined) {
        walletName = await resolveWalletName(db, input.walletId, userId);
      }

      const [updated] = await db
        .update(expenses)
        .set({
          ...(input.categoryId !== undefined && { categoryId: input.categoryId, categoryName }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.expenseDate !== undefined && { expenseDate: input.expenseDate }),
          ...(input.walletId !== undefined && { walletId: input.walletId, walletName }),
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

      // Restoring an already-active expense is a no-op write that would falsely
      // report success and bump updatedAt — reject it (WR-06).
      if (!existing.deletedAt) {
        throw new HTTPException(409, { message: 'not_deleted' });
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
