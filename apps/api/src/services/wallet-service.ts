import { HTTPException } from 'hono/http-exception';
import { eq, and, isNull, sql, asc } from 'drizzle-orm';

import { createDb } from '@app/db';
import {
  wallets,
  walletIncomeCategoryMappings,
  walletExpenseCategoryMappings,
  walletTransactions,
  incomeCategories,
  expenseCategories,
  profitFirstAccounts,
  incomes,
  expenses,
} from '@app/db/schema';

import type { z } from 'zod';
import type { createWalletSchema, updateWalletSchema, expenseModeSchema } from '@/schemas/wallets';

type CreateWalletInput = z.infer<typeof createWalletSchema>;
type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
type ExpenseMode = z.infer<typeof expenseModeSchema>;

/** Balance formula (locked): pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals */
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
  // Never clamp — D-13 negative balances are valid
  return pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals;
}

export function createWalletService(db: ReturnType<typeof createDb>) {
  /**
   * Checks whether the user already has a wallet linked to the given PF account.
   * Used for conflict-detection in create().
   */
  async function hasWalletForPfAccount(userId: number, pfAccountId: number): Promise<boolean> {
    const rows = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.profitFirstAccountId, pfAccountId)));
    return rows.length > 0;
  }

  /**
   * Returns the total received income in cents for the user.
   * Only RECEIVED incomes with profitFirstAllocated=true are included.
   */
  async function getTotalReceivedIncomeCents(userId: number): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)` })
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, userId),
          eq(incomes.moneyStatus, 'RECEIVED'),
          eq(incomes.profitFirstAllocated, true)
        )
      );
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Returns per-wallet manual transaction totals (deposits, withdrawals, transactionCount).
   * Excludes soft-deleted transactions from the balance computation but counts them separately.
   */
  async function getPerWalletTransactionImpact(userId: number): Promise<
    Map<
      number,
      {
        deposits: number;
        withdrawals: number;
        activeCount: number;
      }
    >
  > {
    // Non-deleted transactions: contribute to balance and count
    const activeRows = await db
      .select({
        walletId: walletTransactions.walletId,
        type: walletTransactions.type,
        amount: sql<number>`SUM(${walletTransactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(walletTransactions)
      .where(and(eq(walletTransactions.userId, userId), isNull(walletTransactions.deletedAt)))
      .groupBy(walletTransactions.walletId, walletTransactions.type);

    const result = new Map<
      number,
      { deposits: number; withdrawals: number; activeCount: number }
    >();

    for (const row of activeRows) {
      const wid = row.walletId;
      if (!result.has(wid)) {
        result.set(wid, { deposits: 0, withdrawals: 0, activeCount: 0 });
      }
      const entry = result.get(wid)!;
      const amount = Number(row.amount ?? 0);
      const count = Number(row.count ?? 0);
      if (row.type === 'DEPOSIT') {
        entry.deposits += amount;
        entry.activeCount += count;
      } else {
        entry.withdrawals += amount;
        entry.activeCount += count;
      }
    }

    return result;
  }

  /**
   * Returns income and expense category mappings grouped by walletId.
   */
  async function getMappingsByWallet(userId: number): Promise<
    Map<
      number,
      {
        incomeCategoryIds: number[];
        expenseCategoryIds: number[];
      }
    >
  > {
    const [incomeMappings, expenseMappings] = await Promise.all([
      db
        .select({
          walletId: walletIncomeCategoryMappings.walletId,
          catId: walletIncomeCategoryMappings.incomeCategoryId,
        })
        .from(walletIncomeCategoryMappings)
        .where(eq(walletIncomeCategoryMappings.userId, userId)),
      db
        .select({
          walletId: walletExpenseCategoryMappings.walletId,
          catId: walletExpenseCategoryMappings.expenseCategoryId,
        })
        .from(walletExpenseCategoryMappings)
        .where(eq(walletExpenseCategoryMappings.userId, userId)),
    ]);

    const result = new Map<number, { incomeCategoryIds: number[]; expenseCategoryIds: number[] }>();

    for (const row of incomeMappings) {
      if (!result.has(row.walletId)) {
        result.set(row.walletId, { incomeCategoryIds: [], expenseCategoryIds: [] });
      }
      result.get(row.walletId)!.incomeCategoryIds.push(row.catId);
    }

    for (const row of expenseMappings) {
      if (!result.has(row.walletId)) {
        result.set(row.walletId, { incomeCategoryIds: [], expenseCategoryIds: [] });
      }
      result.get(row.walletId)!.expenseCategoryIds.push(row.catId);
    }

    return result;
  }

  /**
   * Returns sum of received income amounts by income category id.
   */
  async function getReceivedIncomeByCategoryCents(userId: number): Promise<Map<number, number>> {
    const rows = await db
      .select({
        categoryId: incomes.categoryId,
        total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)`,
      })
      .from(incomes)
      .where(and(eq(incomes.userId, userId), eq(incomes.moneyStatus, 'RECEIVED')))
      .groupBy(incomes.categoryId);

    const result = new Map<number, number>();
    for (const row of rows) {
      result.set(row.categoryId, Number(row.total ?? 0));
    }
    return result;
  }

  /**
   * Returns sum of non-deleted expense amounts by expense category id.
   */
  async function getExpensesByCategoryCents(userId: number): Promise<Map<number, number>> {
    const rows = await db
      .select({
        categoryId: expenses.categoryId,
        total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), isNull(expenses.deletedAt)))
      .groupBy(expenses.categoryId);

    const result = new Map<number, number>();
    for (const row of rows) {
      result.set(row.categoryId, Number(row.total ?? 0));
    }
    return result;
  }

  /**
   * Sets income category mappings for a wallet atomically (clear-and-replace).
   * Validates category ownership and cross-wallet conflicts before writing.
   * Skips entirely if the wallet is PROFIT_FIRST (D-08).
   */
  async function setIncomeCategoryMappings(
    walletId: number,
    userId: number,
    sourceType: string,
    ids: number[]
  ): Promise<void> {
    // D-08: PF wallets skip income-category mapping
    if (sourceType === 'PROFIT_FIRST') return;
    if (ids.length === 0) {
      // Just clear existing mappings
      await db
        .delete(walletIncomeCategoryMappings)
        .where(
          and(
            eq(walletIncomeCategoryMappings.walletId, walletId),
            eq(walletIncomeCategoryMappings.userId, userId)
          )
        );
      return;
    }

    // T-04-07: validate each category belongs to userId
    const ownedCats = await db
      .select({ id: incomeCategories.id })
      .from(incomeCategories)
      .where(and(eq(incomeCategories.userId, userId)));
    const ownedIds = new Set(ownedCats.map((c) => c.id));
    for (const id of ids) {
      if (!ownedIds.has(id)) {
        throw new HTTPException(403, { message: 'forbidden' });
      }
    }

    // Conflict check: any of these categories already mapped to a DIFFERENT wallet?
    const conflicts = await db
      .select({
        walletId: walletIncomeCategoryMappings.walletId,
        catId: walletIncomeCategoryMappings.incomeCategoryId,
      })
      .from(walletIncomeCategoryMappings)
      .where(eq(walletIncomeCategoryMappings.incomeCategoryId, ids[0]));

    // Check all ids
    for (const id of ids) {
      const conflictRows = await db
        .select({ existingWalletId: walletIncomeCategoryMappings.walletId })
        .from(walletIncomeCategoryMappings)
        .where(eq(walletIncomeCategoryMappings.incomeCategoryId, id));
      if (conflictRows.length > 0 && conflictRows[0].existingWalletId !== walletId) {
        throw new HTTPException(409, { message: 'income_category_already_mapped' });
      }
    }

    // Suppress unused variable warning
    void conflicts;

    // Atomic clear-and-replace via batch (RESEARCH Pattern 2 / Pitfall 7)
    const deleteStmt = db
      .delete(walletIncomeCategoryMappings)
      .where(
        and(
          eq(walletIncomeCategoryMappings.walletId, walletId),
          eq(walletIncomeCategoryMappings.userId, userId)
        )
      );
    const insertStmt = db
      .insert(walletIncomeCategoryMappings)
      .values(ids.map((cid) => ({ walletId, incomeCategoryId: cid, userId })));
    // intentional: Drizzle 0.45.2 D1 adapter doesn't type .batch() on the return of createDb
    await (db as any).batch([deleteStmt, insertStmt]); // intentional: D1 batch cast
  }

  /**
   * Sets expense mappings for a wallet based on the 3-mode discriminated union.
   * Validates category ownership and cross-wallet conflicts before writing.
   */
  async function setExpenseMappings(
    walletId: number,
    userId: number,
    mode: ExpenseMode
  ): Promise<void> {
    if (mode.kind === 'NONE') {
      // Clear all expense mappings and unset autoDeductAllExpenses
      await db
        .delete(walletExpenseCategoryMappings)
        .where(
          and(
            eq(walletExpenseCategoryMappings.walletId, walletId),
            eq(walletExpenseCategoryMappings.userId, userId)
          )
        );
      await db
        .update(wallets)
        .set({ autoDeductAllExpenses: false })
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      return;
    }

    if (mode.kind === 'ALL') {
      // Pitfall 1: check no other wallet already has autoDeductAllExpenses=true
      const existing = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.autoDeductAllExpenses, true)));
      const conflict = existing.find((w) => w.id !== walletId);
      if (conflict) {
        throw new HTTPException(409, { message: 'auto_deduct_all_already_set' });
      }
      // Clear specific mappings and set flag
      await db
        .delete(walletExpenseCategoryMappings)
        .where(
          and(
            eq(walletExpenseCategoryMappings.walletId, walletId),
            eq(walletExpenseCategoryMappings.userId, userId)
          )
        );
      await db
        .update(wallets)
        .set({ autoDeductAllExpenses: true })
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      return;
    }

    // mode.kind === 'CATEGORIES'
    const ids = mode.ids;

    // T-04-07: validate each category belongs to userId
    const ownedCats = await db
      .select({ id: expenseCategories.id })
      .from(expenseCategories)
      .where(and(eq(expenseCategories.userId, userId)));
    const ownedIds = new Set(ownedCats.map((c) => c.id));
    for (const id of ids) {
      if (!ownedIds.has(id)) {
        throw new HTTPException(403, { message: 'forbidden' });
      }
    }

    // Conflict check: any category mapped to a different wallet?
    for (const id of ids) {
      const conflictRows = await db
        .select({ existingWalletId: walletExpenseCategoryMappings.walletId })
        .from(walletExpenseCategoryMappings)
        .where(eq(walletExpenseCategoryMappings.expenseCategoryId, id));
      if (conflictRows.length > 0 && conflictRows[0].existingWalletId !== walletId) {
        throw new HTTPException(409, { message: 'expense_category_already_mapped' });
      }
    }

    // Atomic clear-and-replace (RESEARCH Pattern 2 / Pitfall 7)
    const deleteStmt = db
      .delete(walletExpenseCategoryMappings)
      .where(
        and(
          eq(walletExpenseCategoryMappings.walletId, walletId),
          eq(walletExpenseCategoryMappings.userId, userId)
        )
      );
    const insertStmt = db
      .insert(walletExpenseCategoryMappings)
      .values(ids.map((cid) => ({ walletId, expenseCategoryId: cid, userId })));
    // intentional: Drizzle 0.45.2 D1 adapter doesn't type .batch() on the return of createDb
    await (db as any).batch([deleteStmt, insertStmt]); // intentional: D1 batch cast
    await db
      .update(wallets)
      .set({ autoDeductAllExpenses: false })
      .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
  }

  return {
    /**
     * Lists all wallets for the user with computed balanceCents, transactionCount, and mappingCount.
     * Uses a 7-way Promise.all to avoid N+1 queries (RESEARCH Pattern 1).
     */
    async list(userId: number) {
      const [
        walletRows,
        totalReceivedIncome,
        txImpactByWallet,
        mappingsByWallet,
        incomeByCategory,
        expenseByCategory,
        pfAccountRows,
      ] = await Promise.all([
        db
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId))
          .orderBy(asc(wallets.sortOrder), asc(wallets.id)),
        getTotalReceivedIncomeCents(userId),
        getPerWalletTransactionImpact(userId),
        getMappingsByWallet(userId),
        getReceivedIncomeByCategoryCents(userId),
        getExpensesByCategoryCents(userId),
        db.select().from(profitFirstAccounts).where(eq(profitFirstAccounts.userId, userId)),
      ]);

      const pfAccountMap = new Map(pfAccountRows.map((a) => [a.id, a]));

      return walletRows.map((wallet) => {
        const mappings = mappingsByWallet.get(wallet.id) ?? {
          incomeCategoryIds: [],
          expenseCategoryIds: [],
        };
        const txImpact = txImpactByWallet.get(wallet.id) ?? {
          deposits: 0,
          withdrawals: 0,
          activeCount: 0,
        };

        // pfAllocation: only for PROFIT_FIRST wallets
        let pfAllocation = 0;
        if (wallet.sourceType === 'PROFIT_FIRST' && wallet.profitFirstAccountId != null) {
          const pfAccount = pfAccountMap.get(wallet.profitFirstAccountId);
          if (pfAccount) {
            pfAllocation = Math.round((totalReceivedIncome * pfAccount.targetPercentage) / 10000);
          }
        }

        // mappedIncome: sum of received income for all mapped income categories
        const mappedIncome = mappings.incomeCategoryIds.reduce(
          (sum, catId) => sum + (incomeByCategory.get(catId) ?? 0),
          0
        );

        // mappedExpenses: sum of non-deleted expenses for mapped expense categories
        // When autoDeductAllExpenses=true, ALL non-deleted expenses for the user are deducted
        let mappedExpenses = 0;
        if (wallet.autoDeductAllExpenses) {
          mappedExpenses = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0);
        } else {
          mappedExpenses = mappings.expenseCategoryIds.reduce(
            (sum, catId) => sum + (expenseByCategory.get(catId) ?? 0),
            0
          );
        }

        const balanceCents = computeBalanceCents({
          pfAllocation,
          mappedIncome,
          mappedExpenses,
          deposits: txImpact.deposits,
          withdrawals: txImpact.withdrawals,
        });

        const mappingCount = mappings.incomeCategoryIds.length + mappings.expenseCategoryIds.length;

        return {
          ...wallet,
          balanceCents,
          transactionCount: txImpact.activeCount,
          mappingCount,
        };
      });
    },

    hasWalletForPfAccount,

    /**
     * Creates a new wallet for the user. Validates PF link uniqueness.
     * Appends sortOrder = max+1 when not provided (D-03).
     */
    async create(userId: number, input: CreateWalletInput) {
      // Validate PF link uniqueness (WAL-01)
      if (input.sourceType === 'PROFIT_FIRST' && input.profitFirstAccountId != null) {
        const alreadyLinked = await hasWalletForPfAccount(userId, input.profitFirstAccountId);
        if (alreadyLinked) {
          throw new HTTPException(409, { message: 'wallet_pf_account_already_linked' });
        }
      }

      // Compute sortOrder if not provided (D-03)
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined || sortOrder === null) {
        const maxRows = await db
          .select({ max: sql<number>`COALESCE(MAX(${wallets.sortOrder}), -1)` })
          .from(wallets)
          .where(eq(wallets.userId, userId));
        sortOrder = Number(maxRows[0]?.max ?? -1) + 1;
      }

      const [created] = await db
        .insert(wallets)
        .values({
          userId,
          name: input.name,
          sourceType: input.sourceType,
          profitFirstAccountId: input.profitFirstAccountId ?? null,
          color: input.color ?? '#10b981',
          sortOrder,
          autoDeductAllExpenses: false,
        })
        .returning();

      // Apply mappings after creation
      if (input.incomeCategoryIds && input.incomeCategoryIds.length > 0) {
        await setIncomeCategoryMappings(
          created.id,
          userId,
          created.sourceType,
          input.incomeCategoryIds
        );
      }
      if (input.expenseMode) {
        await setExpenseMappings(created.id, userId, input.expenseMode);
      }

      // Re-fetch so that any autoDeductAllExpenses updates from setExpenseMappings are reflected
      const [fresh] = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, created.id), eq(wallets.userId, userId)));
      return fresh ?? created;
    },

    /**
     * Updates mutable fields of a wallet. Ownership-scoped.
     * PF wallets do not touch income mappings (D-08) — handled inside setIncomeCategoryMappings.
     */
    async update(walletId: number, userId: number, input: UpdateWalletInput) {
      const rows = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      const wallet = rows[0];
      if (!wallet) throw new HTTPException(404, { message: 'not_found' });

      // Update mutable fields
      const updateData: Partial<typeof wallet> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(wallets)
          .set(updateData)
          .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      }

      // Apply mapping updates
      if (input.incomeCategoryIds !== undefined) {
        await setIncomeCategoryMappings(
          walletId,
          userId,
          wallet.sourceType,
          input.incomeCategoryIds
        );
      }
      if (input.expenseMode) {
        await setExpenseMappings(walletId, userId, input.expenseMode);
      }

      const [updated] = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      return updated ?? wallet;
    },

    /**
     * Hard-deletes a wallet (cascades to mappings + transactions via FK).
     * Returns impact counts from before the delete (D-16).
     */
    async remove(walletId: number, userId: number) {
      const rows = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });

      // Count non-deleted transactions before delete
      const txCountRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(walletTransactions)
        .where(
          and(eq(walletTransactions.walletId, walletId), isNull(walletTransactions.deletedAt))
        );
      const transactionCount = Number(txCountRows[0]?.count ?? 0);

      // Count income + expense mappings
      const [incMappingRows, expMappingRows] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(walletIncomeCategoryMappings)
          .where(eq(walletIncomeCategoryMappings.walletId, walletId)),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(walletExpenseCategoryMappings)
          .where(eq(walletExpenseCategoryMappings.walletId, walletId)),
      ]);
      const mappingCount =
        Number(incMappingRows[0]?.count ?? 0) + Number(expMappingRows[0]?.count ?? 0);

      // Hard-delete wallet (cascade FKs remove mappings + transactions)
      await db.delete(wallets).where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));

      return { id: walletId, transactionCount, mappingCount };
    },

    setIncomeCategoryMappings,
    setExpenseMappings,
  };
}
