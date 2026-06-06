import { eq, and, ne, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import { profitFirstAccounts, incomes } from '@app/db/schema';

/**
 * Seeds the four canonical Profit First allocation accounts for a newly created user.
 *
 * Default values (D-03):
 * - Profit: 5% (500 bp), #10b981, sort 0
 * - Owner Pay: 50% (5000 bp), #8b5cf6, sort 1
 * - Tax: 15% (1500 bp), #f59e0b, sort 2
 * - Operating Expenses: 30% (3000 bp), #f43f5e, sort 3
 *
 * The unique index on (userId, name) makes this safe to call idempotently —
 * a second call for the same userId will throw a constraint error, which is
 * the desired behaviour (prevents duplicates for returning users).
 *
 * Call ONLY from:
 * 1. register() — after user insert, before issueVerifyToken
 * 2. upsertGoogleUser() branch 3 (brand-new user) — never branches 1 or 2
 *
 * @param db  Drizzle instance (pass createDb(c.env.DB) per request)
 * @param userId  Freshly inserted user.id — never client-supplied
 */
export async function seedProfitFirstAccounts(
  db: ReturnType<typeof createDb>,
  userId: number
): Promise<void> {
  const defaults = [
    {
      name: 'Profit',
      targetPercentage: 500,
      color: '#10b981',
      sortOrder: 0,
      accountType: 'PROFIT' as const,
    },
    {
      name: 'Owner Pay',
      targetPercentage: 5000,
      color: '#8b5cf6',
      sortOrder: 1,
      accountType: 'OWNERS_PAY' as const,
    },
    {
      name: 'Tax',
      targetPercentage: 1500,
      color: '#f59e0b',
      sortOrder: 2,
      accountType: 'TAX' as const,
    },
    {
      name: 'Operating Expenses',
      targetPercentage: 3000,
      color: '#f43f5e',
      sortOrder: 3,
      accountType: 'OPEX' as const,
    },
  ] as const;

  await db.insert(profitFirstAccounts).values(defaults.map((d) => ({ ...d, userId })));
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type DateRange = {
  from?: string;
  to?: string;
};

export type SummaryFilters = {
  categoryIds?: number[];
};

export type AccountSummaryItem = {
  id: number;
  name: string;
  /** Percent (0–100) — converted from basis points for UI compatibility (Pitfall 3) */
  targetPercentage: number;
  color: string;
  sortOrder: number;
  accountType: string;
  /** Computed balance in cents — integer math only */
  computedBalance: number;
};

export type ProfitFirstSummary = {
  /** Total received + allocated income in cents */
  totalIncome: number;
  accounts: AccountSummaryItem[];
  /**
   * Distinct income categories present in the user's RECEIVED + profitFirstAllocated income.
   * Always the full set regardless of active date/category filters — provides filter options.
   * Empty array when the user has no qualifying income.
   */
  categories: Array<{ id: number; name: string }>;
};

export type CreateAccountInput = {
  name: string;
  /** Basis points (0–10000) */
  targetPercentage: number;
  color: string;
  sortOrder?: number;
};

export type UpdateAccountInput = {
  name?: string;
  /** Basis points (0–10000) */
  targetPercentage?: number;
  color?: string;
  sortOrder?: number;
};

export type UpdatePercentagesInput = {
  accounts: Array<{
    id: number;
    /** Basis points (0–10000) */
    targetPercentage: number;
  }>;
};

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Factory for Profit First service methods.
 *
 * Receives a Drizzle db instance (created per-request in the route handler via
 * createDb(c.env.DB) — never at module scope, Pitfall 8).
 *
 * All queries are scoped to the authenticated userId — no IDOR possible (T-03-04).
 *
 * @param db  Drizzle instance created from c.env.DB binding
 */
export function createProfitFirstService(db: ReturnType<typeof createDb>) {
  /**
   * Computes the total received + Profit First allocated income for a user.
   * Optionally filtered by date range and category IDs.
   *
   * @returns Total income in integer cents (COALESCE to 0 when no matching rows)
   */
  async function getTotalReceivedIncome(
    userId: number,
    dateRange?: DateRange,
    filters?: SummaryFilters
  ): Promise<number> {
    // Build the WHERE conditions incrementally
    const conditions = [
      eq(incomes.userId, userId),
      eq(incomes.moneyStatus, 'RECEIVED'),
      eq(incomes.profitFirstAllocated, true),
    ];

    if (dateRange?.from) {
      conditions.push(sql`${incomes.incomeDate} >= ${dateRange.from}` as ReturnType<typeof eq>);
    }
    if (dateRange?.to) {
      conditions.push(sql`${incomes.incomeDate} <= ${dateRange.to}` as ReturnType<typeof eq>);
    }
    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      // D1/SQLite: use SQL inArray via raw SQL for the IN-list
      const ids = filters.categoryIds;
      conditions.push(
        sql`${incomes.categoryId} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `
        )})` as ReturnType<typeof eq>
      );
    }

    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)` })
      .from(incomes)
      .where(and(...conditions));

    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Returns the DISTINCT (categoryId, categoryName) pairs from the user's
   * RECEIVED + profitFirstAllocated income, ordered by name.
   *
   * Intentionally does NOT apply date-range or categoryIds filters — the option
   * list must remain complete regardless of which filter is active (T-03-06-01:
   * scoped strictly to userId to prevent cross-user data leakage).
   *
   * @param userId  Authenticated user ID — always server-supplied, never from input
   * @returns Ordered list of distinct categories; empty array when no qualifying income
   */
  async function getIncomeCategories(userId: number): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
      .selectDistinct({ id: incomes.categoryId, name: incomes.categoryName })
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, userId),
          eq(incomes.moneyStatus, 'RECEIVED'),
          eq(incomes.profitFirstAllocated, true)
        )
      )
      .orderBy(incomes.categoryName);

    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  /**
   * Computes the derived balance for a single account.
   * Integer math only — no floating point (Pitfall 2, D-08).
   *
   * @param totalIncomeCents  Total received+allocated income in cents
   * @param targetPercentage  Account allocation in basis points (0–10000)
   * @returns Integer cents
   */
  function computeBalance(totalIncomeCents: number, targetPercentage: number): number {
    return Math.round((totalIncomeCents * targetPercentage) / 10000);
  }

  return {
    /**
     * Returns the allocation summary: total received income and per-account
     * derived balances, all scoped to the authenticated user.
     *
     * Response note: targetPercentage is returned as PERCENT (bp/100, e.g. 5 for 500 bp)
     * so the UI editor's `total === 100` check works directly (Pitfall 3).
     */
    async getSummary(
      userId: number,
      dateRange?: DateRange,
      filters?: SummaryFilters
    ): Promise<ProfitFirstSummary> {
      // Parallel queries to minimize D1 round-trips
      const [totalIncome, accounts, categories] = await Promise.all([
        getTotalReceivedIncome(userId, dateRange, filters),
        db
          .select()
          .from(profitFirstAccounts)
          .where(eq(profitFirstAccounts.userId, userId))
          .orderBy(profitFirstAccounts.sortOrder),
        // Category list is always unfiltered — must show all options regardless of active filter
        getIncomeCategories(userId),
      ]);

      return {
        totalIncome,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          // Convert bp → percent for the UI (Pitfall 3)
          targetPercentage: a.targetPercentage / 100,
          color: a.color,
          sortOrder: a.sortOrder,
          accountType: a.accountType,
          computedBalance: computeBalance(totalIncome, a.targetPercentage),
        })),
        categories,
      };
    },

    /**
     * Creates a new custom Profit First account for the user.
     * Rejects if adding the new account would push total basis points over 10000.
     *
     * @throws HTTPException 400 if the total would exceed 10000 bp
     * @throws HTTPException 400 if an account with this name already exists
     */
    async createAccount(userId: number, input: CreateAccountInput) {
      // Parallel fetch of current sum + max sortOrder
      const [sumRows, maxRows] = await Promise.all([
        db
          .select({ total: sql<number>`COALESCE(SUM(${profitFirstAccounts.targetPercentage}), 0)` })
          .from(profitFirstAccounts)
          .where(eq(profitFirstAccounts.userId, userId)),
        db
          .select({ maxSort: sql<number>`COALESCE(MAX(${profitFirstAccounts.sortOrder}), -1)` })
          .from(profitFirstAccounts)
          .where(eq(profitFirstAccounts.userId, userId)),
      ]);

      const currentSum = Number(sumRows[0]?.total ?? 0);
      const maxSort = Number(maxRows[0]?.maxSort ?? -1);

      if (currentSum + input.targetPercentage > 10000) {
        throw new HTTPException(400, {
          message: 'Adding this account would exceed 100%. Reduce other percentages first.',
        });
      }

      const sortOrder = input.sortOrder ?? maxSort + 1;

      try {
        const inserted = await db
          .insert(profitFirstAccounts)
          .values({
            name: input.name,
            targetPercentage: input.targetPercentage,
            color: input.color,
            sortOrder,
            accountType: 'CUSTOM',
            userId,
          })
          .returning();
        return inserted[0];
      } catch (err) {
        // Surface the unique(userId, name) constraint violation as a user-facing 400
        if (err instanceof Error && err.message.includes('UNIQUE')) {
          throw new HTTPException(400, {
            message: 'An account with this name already exists.',
          });
        }
        throw err;
      }
    },

    /**
     * Partially updates a Profit First account owned by the user.
     * If targetPercentage changes, validates that the new total stays within 10000 bp.
     *
     * @throws HTTPException 404 if the account does not exist or belongs to another user
     * @throws HTTPException 400 if the new percentage would exceed 10000 bp total
     */
    async updateAccount(accountId: number, userId: number, input: UpdateAccountInput) {
      // Fetch existing row scoped to userId (IDOR guard)
      const rows = await db
        .select()
        .from(profitFirstAccounts)
        .where(and(eq(profitFirstAccounts.id, accountId), eq(profitFirstAccounts.userId, userId)));
      const existing = rows[0];

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      // Validate percentage change does not exceed total budget
      if (input.targetPercentage !== undefined) {
        const sumRows = await db
          .select({ total: sql<number>`COALESCE(SUM(${profitFirstAccounts.targetPercentage}), 0)` })
          .from(profitFirstAccounts)
          .where(
            and(eq(profitFirstAccounts.userId, userId), ne(profitFirstAccounts.id, accountId))
          );
        const otherSum = Number(sumRows[0]?.total ?? 0);

        if (otherSum + input.targetPercentage > 10000) {
          throw new HTTPException(400, {
            message: 'Adding this account would exceed 100%. Reduce other percentages first.',
          });
        }
      }

      const updated = await db
        .update(profitFirstAccounts)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.targetPercentage !== undefined
            ? { targetPercentage: input.targetPercentage }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(profitFirstAccounts.id, accountId), eq(profitFirstAccounts.userId, userId)))
        .returning();

      return updated[0];
    },

    /**
     * Deletes a CUSTOM Profit First account owned by the user.
     *
     * Guards:
     * 1. Account must exist and be owned by the caller (404 otherwise)
     * 2. Account must be of type CUSTOM (400 otherwise)
     *
     * Phase 4 wallet-link guard (STUB — wallets table does not exist in Phase 3):
     * Uncomment in Phase 4 after the wallets table is created.
     *
     * @throws HTTPException 404 if the account does not exist or belongs to another user
     * @throws HTTPException 400 if the account is a default (non-CUSTOM) account
     */
    async deleteAccount(accountId: number, userId: number): Promise<void> {
      const rows = await db
        .select()
        .from(profitFirstAccounts)
        .where(and(eq(profitFirstAccounts.id, accountId), eq(profitFirstAccounts.userId, userId)));
      const existing = rows[0];

      if (!existing) {
        throw new HTTPException(404, { message: 'not_found' });
      }

      if (existing.accountType !== 'CUSTOM') {
        throw new HTTPException(400, { message: 'Default accounts cannot be deleted.' });
      }

      // PHASE 4 WALLET-LINK GUARD — uncomment when wallets table is added:
      // const walletLinks = await db
      //   .select()
      //   .from(wallets)
      //   .where(
      //     and(eq(wallets.profitFirstAccountId, accountId), eq(wallets.userId, userId))
      //   );
      // if (walletLinks.length > 0) {
      //   throw new HTTPException(400, {
      //     message: 'Cannot delete an account that is linked to a wallet. Remove the wallet link first.',
      //   });
      // }

      await db
        .delete(profitFirstAccounts)
        .where(and(eq(profitFirstAccounts.id, accountId), eq(profitFirstAccounts.userId, userId)));
    },

    /**
     * Bulk-updates targetPercentage for all submitted accounts.
     * Server-enforced: the submitted set must cover exactly the user's owned accounts
     * (no missing, no foreign, no duplicates), then the total must equal exactly 10000 bp.
     *
     * @throws HTTPException 400 if the submitted set does not cover exactly the user's owned accounts
     * @throws HTTPException 400 if the submitted percentages do not sum to exactly 10000 bp
     */
    async updatePercentages(userId: number, input: UpdatePercentagesInput) {
      // Step 1 — Fetch all account IDs owned by this user (server-authoritative set)
      const owned = await db
        .select({ id: profitFirstAccounts.id })
        .from(profitFirstAccounts)
        .where(eq(profitFirstAccounts.userId, userId));
      const ownedIds = new Set<number>(owned.map((a) => a.id));

      // Step 2 — Build the submitted ID set
      const submittedIds = new Set<number>(input.accounts.map((a) => a.id));

      // Step 3 — Reject if submitted set does not exactly cover the owned set
      // Covers: duplicate ids in payload, missing owned ids, foreign ids, count mismatches
      if (
        submittedIds.size !== input.accounts.length ||
        ownedIds.size !== submittedIds.size ||
        [...submittedIds].some((id) => !ownedIds.has(id))
      ) {
        throw new HTTPException(400, {
          message: 'Submit all accounts exactly once.',
        });
      }

      // Step 4 — Validate sum after coverage check passes
      const sum = input.accounts.reduce((acc, a) => acc + a.targetPercentage, 0);

      if (sum !== 10000) {
        const percent = sum / 100;
        throw new HTTPException(400, {
          message: `Percentages must total 100%. Current total: ${percent}%.`,
        });
      }

      // Update all accounts in parallel, each scoped to userId (IDOR guard)
      await Promise.all(
        input.accounts.map((a) =>
          db
            .update(profitFirstAccounts)
            .set({ targetPercentage: a.targetPercentage, updatedAt: new Date().toISOString() })
            .where(and(eq(profitFirstAccounts.id, a.id), eq(profitFirstAccounts.userId, userId)))
        )
      );

      // Return the updated accounts ordered by sortOrder
      return db
        .select()
        .from(profitFirstAccounts)
        .where(eq(profitFirstAccounts.userId, userId))
        .orderBy(profitFirstAccounts.sortOrder);
    },
  };
}
