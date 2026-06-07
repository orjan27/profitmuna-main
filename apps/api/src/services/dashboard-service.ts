import { eq, and, isNull, sql, desc } from 'drizzle-orm';

import { createDb } from '@app/db';
import {
  incomes,
  expenses,
  wallets,
  walletIncomeCategoryMappings,
  walletTransactions,
  profitFirstAccounts,
} from '@app/db/schema';

import {
  createProfitFirstService,
  type DateRange,
  type AccountSummaryItem,
} from '@/services/profit-first-service';

import type { AnyColumn } from 'drizzle-orm';

// ─── Types ─────────────────────────────────────────────────────────────────

export type RecentTransactionKind = 'income' | 'expense' | 'wallet_deposit' | 'wallet_withdrawal';

export type RecentTransaction = {
  id: number;
  kind: RecentTransactionKind;
  /** ISO YYYY-MM-DD */
  date: string;
  amountCents: number;
  description: string | null;
  /** Category name for income/expense rows; wallet name for wallet tx rows */
  label: string;
  /** Navigation target for the feed row (D-05) */
  href: string;
};

export type FeedPagination = {
  page: number;
  size: number;
  hasMore: boolean;
};

export type DashboardSummary = {
  totalIncomeReceivedCents: number;
  totalIncomePendingCents: number;
  totalExpensesCents: number;
  /** Received income minus expenses — pending income does not count */
  netIncomeCents: number;
  /** Period-scoped sum across all wallets (NOT the all-time wallet list balance) */
  totalWalletBalanceCents: number;
  /** Total received + allocated income in cents (PF summary passthrough) */
  totalIncome: number;
  profitFirstAccounts: AccountSummaryItem[];
  recentTransactions: RecentTransaction[];
  feedPagination: FeedPagination;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Balance formula (locked, same as wallet-service): pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals */
function computeBalanceCents({
  pfAllocation,
  mappedIncome,
  mappedExpenses,
  deposits,
  withdrawals,
}: {
  pfAllocation: number;
  mappedIncome: number;
  mappedExpenses: number;
  deposits: number;
  withdrawals: number;
}): number {
  // Never clamp — negative balances are valid (D-13)
  return pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals;
}

/**
 * Builds the optional date-range conditions for the given date column.
 * Values are Zod-validated YYYY-MM-DD strings (T-05-02) bound as SQL params.
 */
function dateConditions(column: AnyColumn, dateRange?: DateRange): ReturnType<typeof eq>[] {
  const conditions: ReturnType<typeof eq>[] = [];
  if (dateRange?.from) {
    conditions.push(sql`${column} >= ${dateRange.from}` as ReturnType<typeof eq>);
  }
  if (dateRange?.to) {
    conditions.push(sql`${column} <= ${dateRange.to}` as ReturnType<typeof eq>);
  }
  return conditions;
}

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Factory for the dashboard aggregation service.
 *
 * Receives a Drizzle db instance (created per-request in the route handler via
 * createDb(c.env.DB) — never at module scope).
 *
 * All queries are scoped to the authenticated userId — no IDOR possible (T-05-03).
 *
 * @param db  Drizzle instance created from c.env.DB binding
 */
export function createDashboardService(db: ReturnType<typeof createDb>) {
  /**
   * Income CASE aggregate: received and pending sums in one query,
   * filtered by incomeDate (NOT the receipt date — consistent with the PF summary).
   */
  async function getIncomeTotals(
    userId: number,
    dateRange?: DateRange
  ): Promise<{ received: number; pending: number }> {
    const rows = await db
      .select({
        received: sql<number>`COALESCE(SUM(CASE WHEN ${incomes.moneyStatus} = 'RECEIVED' THEN ${incomes.amount} ELSE 0 END), 0)`,
        pending: sql<number>`COALESCE(SUM(CASE WHEN ${incomes.moneyStatus} = 'PENDING' THEN ${incomes.amount} ELSE 0 END), 0)`,
      })
      .from(incomes)
      .where(and(eq(incomes.userId, userId), ...dateConditions(incomes.incomeDate, dateRange)));

    return {
      received: Number(rows[0]?.received ?? 0),
      pending: Number(rows[0]?.pending ?? 0),
    };
  }

  /** Non-deleted expense sum, filtered by expenseDate. */
  async function getExpenseTotal(userId: number, dateRange?: DateRange): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          isNull(expenses.deletedAt),
          ...dateConditions(expenses.expenseDate, dateRange)
        )
      );
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Period-scoped total balance across all of the user's wallets.
   *
   * Reimplements the wallet-service balance assembly with every input filtered
   * to the date range — deliberately NOT the wallet service's list(), which is
   * all-time (Pitfall 1). pfAllocation uses targetPercentage in BASIS POINTS.
   */
  async function getPeriodScopedWalletBalance(
    userId: number,
    dateRange?: DateRange
  ): Promise<number> {
    const [
      walletRows,
      pfAccountRows,
      incomeMappings,
      totalReceivedIncomeRows,
      incomeByCategoryRows,
      expenseByWalletRows,
      txRows,
    ] = await Promise.all([
      db
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, userId), isNull(wallets.deletedAt))),
      db.select().from(profitFirstAccounts).where(eq(profitFirstAccounts.userId, userId)),
      db
        .select({
          walletId: walletIncomeCategoryMappings.walletId,
          catId: walletIncomeCategoryMappings.incomeCategoryId,
        })
        .from(walletIncomeCategoryMappings)
        .where(eq(walletIncomeCategoryMappings.userId, userId)),
      // Received + allocated income in range — feeds the PF allocation share
      db
        .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)` })
        .from(incomes)
        .where(
          and(
            eq(incomes.userId, userId),
            eq(incomes.moneyStatus, 'RECEIVED'),
            eq(incomes.profitFirstAllocated, true),
            ...dateConditions(incomes.incomeDate, dateRange)
          )
        ),
      // Received income per category in range — feeds mappedIncome
      db
        .select({
          categoryId: incomes.categoryId,
          total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)`,
        })
        .from(incomes)
        .where(
          and(
            eq(incomes.userId, userId),
            eq(incomes.moneyStatus, 'RECEIVED'),
            ...dateConditions(incomes.incomeDate, dateRange)
          )
        )
        .groupBy(incomes.categoryId),
      // Non-deleted expenses per wallet in range — feeds mappedExpenses (deduct by walletId)
      db
        .select({
          walletId: expenses.walletId,
          total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            isNull(expenses.deletedAt),
            sql`${expenses.walletId} IS NOT NULL`,
            ...dateConditions(expenses.expenseDate, dateRange)
          )
        )
        .groupBy(expenses.walletId),
      // Non-deleted manual transactions per wallet+type in range
      db
        .select({
          walletId: walletTransactions.walletId,
          type: walletTransactions.type,
          total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)`,
        })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.userId, userId),
            isNull(walletTransactions.deletedAt),
            ...dateConditions(walletTransactions.transactionDate, dateRange)
          )
        )
        .groupBy(walletTransactions.walletId, walletTransactions.type),
    ]);

    const totalReceivedIncome = Number(totalReceivedIncomeRows[0]?.total ?? 0);
    const pfAccountMap = new Map(pfAccountRows.map((a) => [a.id, a]));

    const incomeByCategory = new Map(
      incomeByCategoryRows.map((r) => [r.categoryId, Number(r.total ?? 0)])
    );
    const expenseByWallet = new Map<number, number>();
    for (const row of expenseByWalletRows) {
      if (row.walletId != null) expenseByWallet.set(row.walletId, Number(row.total ?? 0));
    }

    const mappingsByWallet = new Map<number, { incomeCategoryIds: number[] }>();
    for (const row of incomeMappings) {
      if (!mappingsByWallet.has(row.walletId)) {
        mappingsByWallet.set(row.walletId, { incomeCategoryIds: [] });
      }
      mappingsByWallet.get(row.walletId)!.incomeCategoryIds.push(row.catId);
    }

    const txByWallet = new Map<number, { deposits: number; withdrawals: number }>();
    for (const row of txRows) {
      if (!txByWallet.has(row.walletId)) {
        txByWallet.set(row.walletId, { deposits: 0, withdrawals: 0 });
      }
      const entry = txByWallet.get(row.walletId)!;
      if (row.type === 'DEPOSIT') {
        entry.deposits += Number(row.total ?? 0);
      } else {
        entry.withdrawals += Number(row.total ?? 0);
      }
    }

    return walletRows.reduce((sum, wallet) => {
      const mappings = mappingsByWallet.get(wallet.id) ?? {
        incomeCategoryIds: [],
      };
      const tx = txByWallet.get(wallet.id) ?? { deposits: 0, withdrawals: 0 };

      let pfAllocation = 0;
      if (wallet.profitFirstAccountId != null) {
        const pfAccount = pfAccountMap.get(wallet.profitFirstAccountId);
        if (pfAccount) {
          // targetPercentage is BASIS POINTS here (raw table value)
          pfAllocation = Math.round((totalReceivedIncome * pfAccount.targetPercentage) / 10000);
        }
      }

      const mappedIncome = mappings.incomeCategoryIds.reduce(
        (acc, catId) => acc + (incomeByCategory.get(catId) ?? 0),
        0
      );

      const mappedExpenses = expenseByWallet.get(wallet.id) ?? 0;

      return (
        sum +
        computeBalanceCents({
          pfAllocation,
          mappedIncome,
          mappedExpenses,
          deposits: tx.deposits,
          withdrawals: tx.withdrawals,
        })
      );
    }, 0);
  }

  /**
   * Unified recent-transactions feed: income + expense + wallet tx merged,
   * sorted date DESC then id DESC, paginated.
   *
   * Each source is fetched pre-sorted with limit = requested window + 1 so the
   * merge stays bounded and hasMore is decidable even when one source dominates.
   */
  async function getRecentTransactions(
    userId: number,
    dateRange: DateRange | undefined,
    feedPage: number,
    feedSize: number
  ): Promise<{ transactions: RecentTransaction[]; pagination: FeedPagination }> {
    const windowEnd = (feedPage + 1) * feedSize;
    const fetchLimit = windowEnd + 1;

    const [incomeRows, expenseRows, txRows] = await Promise.all([
      db
        .select({
          id: incomes.id,
          date: incomes.incomeDate,
          amountCents: incomes.amount,
          description: incomes.description,
          label: incomes.categoryName,
        })
        .from(incomes)
        .where(and(eq(incomes.userId, userId), ...dateConditions(incomes.incomeDate, dateRange)))
        .orderBy(desc(incomes.incomeDate), desc(incomes.id))
        .limit(fetchLimit),
      db
        .select({
          id: expenses.id,
          date: expenses.expenseDate,
          amountCents: expenses.amount,
          description: expenses.description,
          label: expenses.categoryName,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            isNull(expenses.deletedAt),
            ...dateConditions(expenses.expenseDate, dateRange)
          )
        )
        .orderBy(desc(expenses.expenseDate), desc(expenses.id))
        .limit(fetchLimit),
      db
        .select({
          id: walletTransactions.id,
          date: walletTransactions.transactionDate,
          amountCents: walletTransactions.amount,
          description: walletTransactions.description,
          type: walletTransactions.type,
          walletId: walletTransactions.walletId,
          walletName: wallets.name,
        })
        .from(walletTransactions)
        // T-05-04: the join is constrained to the user's own wallets
        .innerJoin(
          wallets,
          and(eq(walletTransactions.walletId, wallets.id), eq(wallets.userId, userId))
        )
        .where(
          and(
            eq(walletTransactions.userId, userId),
            isNull(walletTransactions.deletedAt),
            ...dateConditions(walletTransactions.transactionDate, dateRange)
          )
        )
        .orderBy(desc(walletTransactions.transactionDate), desc(walletTransactions.id))
        .limit(fetchLimit),
    ]);

    const merged: RecentTransaction[] = [
      ...incomeRows.map((row) => ({
        id: row.id,
        kind: 'income' as const,
        date: row.date,
        amountCents: row.amountCents,
        description: row.description,
        label: row.label,
        href: '/income',
      })),
      ...expenseRows.map((row) => ({
        id: row.id,
        kind: 'expense' as const,
        date: row.date,
        amountCents: row.amountCents,
        description: row.description,
        label: row.label,
        href: '/expenses',
      })),
      ...txRows.map((row) => ({
        id: row.id,
        kind: row.type === 'DEPOSIT' ? ('wallet_deposit' as const) : ('wallet_withdrawal' as const),
        date: row.date,
        amountCents: row.amountCents,
        description: row.description,
        label: row.walletName,
        href: `/wallets/${row.walletId}`,
      })),
    ]
      // ISO YYYY-MM-DD sorts correctly as a string; id DESC breaks date ties
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    return {
      transactions: merged.slice(feedPage * feedSize, windowEnd),
      pagination: { page: feedPage, size: feedSize, hasMore: merged.length > windowEnd },
    };
  }

  return {
    /**
     * Returns the full dashboard summary: stat totals, PF account balances,
     * period-scoped wallet balance, and the unified recent-transactions feed —
     * all restricted to the optional from/to range and scoped to userId.
     */
    async getSummary(
      userId: number,
      dateRange?: DateRange,
      feedPage = 0,
      feedSize = 20
    ): Promise<DashboardSummary> {
      const [incomeTotals, expenseTotal, pfSummary, walletBalance, feed] = await Promise.all([
        getIncomeTotals(userId, dateRange),
        getExpenseTotal(userId, dateRange),
        createProfitFirstService(db).getSummary(userId, dateRange),
        getPeriodScopedWalletBalance(userId, dateRange),
        getRecentTransactions(userId, dateRange, feedPage, feedSize),
      ]);

      return {
        totalIncomeReceivedCents: incomeTotals.received,
        totalIncomePendingCents: incomeTotals.pending,
        totalExpensesCents: expenseTotal,
        netIncomeCents: incomeTotals.received - expenseTotal,
        totalWalletBalanceCents: walletBalance,
        totalIncome: pfSummary.totalIncome,
        profitFirstAccounts: pfSummary.accounts,
        recentTransactions: feed.transactions,
        feedPagination: feed.pagination,
      };
    },
  };
}
