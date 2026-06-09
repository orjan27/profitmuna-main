import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { format } from 'date-fns';

import { createDb } from '@app/db';
import { incomes, incomeCategories, wallets } from '@app/db/schema';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateIncomeInput {
  categoryId: number;
  amount: number;
  description?: string | null;
  incomeDate: string;
  moneyStatus: 'RECEIVED' | 'PENDING';
  expectedReleaseDate?: string | null;
  profitMunaAllocated?: boolean;
  /** Direct wallet top-up: when set, income is added straight to this wallet (PF forced off). */
  walletId?: number | null;
}

export interface UpdateIncomeInput {
  categoryId?: number;
  amount?: number;
  description?: string | null;
  incomeDate?: string;
  moneyStatus?: 'RECEIVED' | 'PENDING';
  expectedReleaseDate?: string | null;
  profitMunaAllocated?: boolean;
}

export interface IncomeListParams {
  page: number;
  limit: number;
  search?: string;
  moneyStatus?: 'RECEIVED' | 'PENDING';
  from?: string;
  to?: string;
}

/**
 * Inputs for the analytics aggregate (INC-stats). Date math (period bounds and
 * the YYYY[-MM] keys) is resolved in the Asia/Manila-aware web layer and passed
 * down as concrete strings, keeping this service timezone-agnostic.
 */
export interface IncomeStatsParams {
  /** Active period lower bound (inclusive); omitted = unbounded (All Time). */
  from?: string;
  /** Active period upper bound (inclusive); omitted = unbounded. */
  to?: string;
  /** Calendar year for the monthly bar series, `YYYY`. */
  year: string;
  /** Current calendar month, `YYYY-MM`. */
  month: string;
  /** Previous calendar month, `YYYY-MM`. */
  prevMonth: string;
}

/** Aggregate figures backing the income analytics band and charts. */
export interface IncomeStats {
  /** Total + record count within the active period (all statuses — "in view"). */
  period: { total: number; count: number };
  /** Current calendar month total (independent of the period filter). */
  thisMonthTotal: number;
  /** Previous calendar month total, for the month-over-month delta. */
  prevMonthTotal: number;
  /** Highest single calendar month all-time, or null when there are no records. */
  bestMonth: { ym: string; total: number } | null;
  /** One bucket per calendar month present in `year` (`ym` = `YYYY-MM`). */
  monthly: { ym: string; total: number }[];
  /** Category breakdown within the active period, descending by total. */
  bySource: { categoryName: string; total: number; count: number }[];
}

// ─── Response type ────────────────────────────────────────────────────────────

export interface IncomeRecord {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  incomeDate: string;
  moneyStatus: 'RECEIVED' | 'PENDING';
  expectedReleaseDate: string | null;
  receivedDate: string | null;
  profitMunaAllocated: boolean;
  walletId: number | null;
  walletName: string | null;
  userId: number;
  createdAt: string | null;
  updatedAt: string | null;
}

function toRecord(row: typeof incomes.$inferSelect): IncomeRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    amount: row.amount,
    description: row.description ?? null,
    incomeDate: row.incomeDate,
    moneyStatus: row.moneyStatus as 'RECEIVED' | 'PENDING',
    expectedReleaseDate: row.expectedReleaseDate ?? null,
    receivedDate: row.receivedDate ?? null,
    profitMunaAllocated: !!row.profitMunaAllocated,
    walletId: row.walletId ?? null,
    walletName: row.walletName ?? null,
    userId: row.userId,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

/**
 * Factory returning the income CRUD service scoped to a Drizzle db instance.
 * All queries include `eq(incomes.userId, userId)` to prevent IDOR (T-02-05).
 */
export function createIncomeService(db: ReturnType<typeof createDb>) {
  return {
    /**
     * INC-02: Paginated list with optional search, status, and date filters.
     */
    async list(
      userId: number,
      params: IncomeListParams
    ): Promise<{ content: IncomeRecord[]; page: number; last: boolean }> {
      const { page, limit, search, moneyStatus, from, to } = params;

      const conditions = [eq(incomes.userId, userId)];

      if (moneyStatus) {
        conditions.push(eq(incomes.moneyStatus, moneyStatus));
      }
      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          or(like(incomes.categoryName, pattern), like(incomes.description, pattern))!
        );
      }
      if (from) {
        conditions.push(sql`${incomes.incomeDate} >= ${from}`);
      }
      if (to) {
        conditions.push(sql`${incomes.incomeDate} <= ${to}`);
      }

      const where = and(...conditions);
      const offset = page * limit;

      // Fetch one extra row to determine if there's a next page (limit+1
      // look-ahead). This matches the expense service and avoids a second COUNT
      // query while giving unambiguous `last` semantics (WR-09).
      const rows = await db
        .select()
        .from(incomes)
        .where(where)
        .orderBy(desc(incomes.incomeDate), desc(incomes.createdAt))
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rows.length > limit;
      const content = (hasMore ? rows.slice(0, limit) : rows).map(toRecord);

      return { content, page, last: !hasMore };
    },

    /**
     * Analytics aggregate for the income ledger: the in-view period total, the
     * month-over-month comparison, the all-time best month, a per-month series
     * for the requested year, and the category breakdown for the period. All
     * figures sum every record (received + pending) so they match "in view".
     */
    async stats(userId: number, params: IncomeStatsParams): Promise<IncomeStats> {
      const { from, to, year, month, prevMonth } = params;
      const ym = sql<string>`substr(${incomes.incomeDate}, 1, 7)`;

      // Period total + count, scoped to the active range (or all-time).
      const periodConds = [eq(incomes.userId, userId)];
      if (from) periodConds.push(sql`${incomes.incomeDate} >= ${from}`);
      if (to) periodConds.push(sql`${incomes.incomeDate} <= ${to}`);

      const [periodRow] = await db
        .select({
          total: sql<number>`coalesce(sum(${incomes.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(incomes)
        .where(and(...periodConds));

      const bySourceRows = await db
        .select({
          categoryName: incomes.categoryName,
          total: sql<number>`coalesce(sum(${incomes.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(incomes)
        .where(and(...periodConds))
        .groupBy(incomes.categoryName)
        .orderBy(desc(sql`sum(${incomes.amount})`));

      // Per-month series for the requested calendar year.
      const monthlyRows = await db
        .select({ ym, total: sql<number>`coalesce(sum(${incomes.amount}), 0)` })
        .from(incomes)
        .where(and(eq(incomes.userId, userId), sql`substr(${incomes.incomeDate}, 1, 4) = ${year}`))
        .groupBy(ym)
        .orderBy(ym);

      // Best single calendar month across all of the user's history.
      const [bestRow] = await db
        .select({ ym, total: sql<number>`coalesce(sum(${incomes.amount}), 0)` })
        .from(incomes)
        .where(eq(incomes.userId, userId))
        .groupBy(ym)
        .orderBy(desc(sql`sum(${incomes.amount})`))
        .limit(1);

      const monthTotal = async (key: string): Promise<number> => {
        const [row] = await db
          .select({ total: sql<number>`coalesce(sum(${incomes.amount}), 0)` })
          .from(incomes)
          .where(
            and(eq(incomes.userId, userId), sql`substr(${incomes.incomeDate}, 1, 7) = ${key}`)
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

    /**
     * INC-01: Create a new income record. Category ownership validated (T-02-07).
     */
    async create(userId: number, input: CreateIncomeInput): Promise<IncomeRecord> {
      // Validate category belongs to this user (T-02-07)
      const category = await db.query.incomeCategories.findFirst({
        where: and(eq(incomeCategories.id, input.categoryId), eq(incomeCategories.userId, userId)),
      });

      if (!category) {
        throw new HTTPException(400, { message: 'invalid_category' });
      }

      // Direct wallet top-up: validate wallet ownership and force PF off so the
      // amount credits this wallet directly instead of feeding the allocation pool.
      let walletId: number | null = null;
      let walletName: string | null = null;
      let profitMunaAllocated = input.profitMunaAllocated ?? true;
      if (input.walletId != null) {
        const wallet = await db.query.wallets.findFirst({
          where: and(eq(wallets.id, input.walletId), eq(wallets.userId, userId)),
        });
        if (!wallet) {
          throw new HTTPException(400, { message: 'invalid_wallet' });
        }
        walletId = wallet.id;
        walletName = wallet.name;
        profitMunaAllocated = false;
      }

      const [inserted] = await db
        .insert(incomes)
        .values({
          categoryId: input.categoryId,
          categoryName: category.name,
          amount: input.amount, // already integer cents from web layer
          description: input.description ?? null,
          incomeDate: input.incomeDate,
          moneyStatus: input.moneyStatus,
          expectedReleaseDate: input.expectedReleaseDate ?? null,
          receivedDate: input.moneyStatus === 'RECEIVED' ? input.incomeDate : null,
          profitMunaAllocated,
          walletId,
          walletName,
          userId,
        })
        .returning();

      return toRecord(inserted!);
    },

    /**
     * Fetch a single income record by id, scoped to userId. Returns 404 if not found.
     */
    async getById(id: number, userId: number): Promise<IncomeRecord> {
      const row = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!row) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      return toRecord(row);
    },

    /**
     * INC-03: Partial update. Re-resolves categoryName if categoryId changes.
     */
    async update(id: number, userId: number, input: UpdateIncomeInput): Promise<IncomeRecord> {
      const existing = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      let categoryName = existing.categoryName;
      if (input.categoryId !== undefined) {
        // Validate the category is still owned and re-resolve its name (WR-07).
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

      const newStatus = input.moneyStatus ?? existing.moneyStatus;
      const oldStatus = existing.moneyStatus;

      // Derive receivedDate from status transitions
      let receivedDate = existing.receivedDate;
      if (newStatus === 'RECEIVED' && oldStatus === 'PENDING') {
        receivedDate = format(new Date(), 'yyyy-MM-dd');
      } else if (newStatus === 'PENDING' && oldStatus === 'RECEIVED') {
        receivedDate = null;
      }

      const updateValues: Partial<typeof incomes.$inferInsert> = {
        ...(input.categoryId !== undefined && { categoryId: input.categoryId, categoryName }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.incomeDate !== undefined && { incomeDate: input.incomeDate }),
        ...(input.moneyStatus !== undefined && { moneyStatus: input.moneyStatus }),
        ...(input.expectedReleaseDate !== undefined && {
          expectedReleaseDate: input.expectedReleaseDate,
        }),
        ...(input.profitMunaAllocated !== undefined && {
          profitMunaAllocated: input.profitMunaAllocated,
        }),
        receivedDate,
      };

      const [updated] = await db
        .update(incomes)
        .set(updateValues)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
        .returning();

      return toRecord(updated!);
    },

    /**
     * INC-05: Mark income as received. Does NOT modify profitMunaAllocated (T-02-08).
     * Uses provided receivedDate or defaults to today.
     *
     * Optional `amount` updates the stored amount at receive time; it is
     * REQUIRED when the stored amount is 0 — recurring "amount set on receive"
     * incomes — since a 0 income can't be meaningfully received.
     */
    async receive(
      id: number,
      userId: number,
      receivedDate?: string,
      amount?: number
    ): Promise<IncomeRecord> {
      const existing = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      if (existing.amount === 0 && amount === undefined) {
        throw new HTTPException(422, { message: 'amount_required' });
      }

      const date = receivedDate ?? format(new Date(), 'yyyy-MM-dd');

      // T-02-08: Only set moneyStatus + receivedDate (+ amount when provided) —
      // never touch profitMunaAllocated
      const [updated] = await db
        .update(incomes)
        .set({
          moneyStatus: 'RECEIVED',
          receivedDate: date,
          ...(amount !== undefined && { amount }),
        })
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
        .returning();

      return toRecord(updated!);
    },

    /**
     * INC-04: Hard-delete the owned income row.
     */
    async delete(id: number, userId: number): Promise<void> {
      const existing = await db.query.incomes.findFirst({
        where: and(eq(incomes.id, id), eq(incomes.userId, userId)),
      });

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
    },
  };
}
