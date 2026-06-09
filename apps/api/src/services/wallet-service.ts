import { HTTPException } from 'hono/http-exception';
import { eq, and, isNull, sql, asc, desc, inArray } from 'drizzle-orm';

import { createDb } from '@app/db';
import {
  wallets,
  walletIncomeCategoryMappings,
  walletTransactions,
  incomeCategories,
  profitMunaAccounts,
  incomes,
  expenses,
} from '@app/db/schema';

import type { z } from 'zod';
import type {
  createWalletSchema,
  updateWalletSchema,
  walletTransactionSchema,
  updateWalletTransactionSchema,
} from '@/schemas/wallets';

type CreateWalletInput = z.infer<typeof createWalletSchema>;
type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
type CreateTransactionInput = z.infer<typeof walletTransactionSchema>;
type UpdateTransactionInput = z.infer<typeof updateWalletTransactionSchema>;

/** Default wallet attributes (locked): undeletable per-user wallet seeded at registration. */
const DEFAULT_WALLET = {
  name: 'Default',
  isDefault: true,
  color: '#10b981',
  sortOrder: 0,
  profitMunaAccountId: null,
} as const;

/**
 * Seeds the undeletable "Default" wallet for a newly created user.
 * Mirrors seedProfitMunaAccounts; call after it in register + Google new-user branch.
 */
export async function seedDefaultWallet(
  db: ReturnType<typeof createDb>,
  userId: number
): Promise<void> {
  await db.insert(wallets).values({ ...DEFAULT_WALLET, userId });
}

/**
 * Balance formula: pmAllocation + mappedIncome - mappedExpenses + deposits - withdrawals + directIncome
 * directIncome = RECEIVED income added straight to this wallet (incomes.walletId set, PF off).
 */
function computeBalanceCents({
  pmAllocation,
  mappedIncome,
  mappedExpenses,
  deposits,
  withdrawals,
  directIncome,
}: {
  pmAllocation: number;
  mappedIncome: number;
  mappedExpenses: number;
  deposits: number;
  withdrawals: number;
  directIncome: number;
}): number {
  // Never clamp — D-13 negative balances are valid
  return pmAllocation + mappedIncome - mappedExpenses + deposits - withdrawals + directIncome;
}

/**
 * Blocking guard: prevents manual DEPOSITs that would double-count automatically sourced money.
 * DEPOSIT blocked when wallet is PF-linked or has income category mappings.
 * WITHDRAWALs are now allowed on all wallets (expense deduction moved onto expenses).
 */
function assertCanInsertTransaction(
  type: 'DEPOSIT' | 'WITHDRAWAL',
  wallet: typeof wallets.$inferSelect,
  mappings: { incomeCategories: number[] }
): void {
  const incomeAuto = mappings.incomeCategories.length > 0;
  const hasPm = !!wallet.profitMunaAccountId;

  if (type === 'DEPOSIT') {
    if (hasPm) throw new HTTPException(400, { message: 'manual_deposit_blocked_pf_wallet' });
    if (incomeAuto)
      throw new HTTPException(400, { message: 'manual_deposit_blocked_income_mapped' });
  }
}

export function createWalletService(db: ReturnType<typeof createDb>) {
  /**
   * Checks whether the user already has a wallet linked to the given PF account.
   * Used for conflict-detection in create().
   */
  async function hasWalletForPmAccount(userId: number, pmAccountId: number): Promise<boolean> {
    const rows = await db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.profitMunaAccountId, pmAccountId)));
    return rows.length > 0;
  }

  /**
   * Returns the total received income in cents for the user.
   * Only RECEIVED incomes with profitMunaAllocated=true are included.
   */
  async function getTotalReceivedIncomeCents(userId: number): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)` })
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, userId),
          eq(incomes.moneyStatus, 'RECEIVED'),
          eq(incomes.profitMunaAllocated, true)
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
   * Returns income category mappings grouped by walletId (income-only now).
   */
  async function getMappingsByWallet(userId: number): Promise<
    Map<
      number,
      {
        incomeCategoryIds: number[];
      }
    >
  > {
    const incomeMappings = await db
      .select({
        walletId: walletIncomeCategoryMappings.walletId,
        catId: walletIncomeCategoryMappings.incomeCategoryId,
      })
      .from(walletIncomeCategoryMappings)
      .where(eq(walletIncomeCategoryMappings.userId, userId));

    const result = new Map<number, { incomeCategoryIds: number[] }>();

    for (const row of incomeMappings) {
      if (!result.has(row.walletId)) {
        result.set(row.walletId, { incomeCategoryIds: [] });
      }
      result.get(row.walletId)!.incomeCategoryIds.push(row.catId);
    }

    return result;
  }

  /**
   * Returns sum of received income amounts by income category id.
   * Excludes wallet-linked income (walletId set) — that belongs to its specific
   * wallet via directIncome, not to category-mapped wallets (avoids double-count).
   */
  async function getReceivedIncomeByCategoryCents(userId: number): Promise<Map<number, number>> {
    const rows = await db
      .select({
        categoryId: incomes.categoryId,
        total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)`,
      })
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, userId),
          eq(incomes.moneyStatus, 'RECEIVED'),
          isNull(incomes.walletId)
        )
      )
      .groupBy(incomes.categoryId);

    const result = new Map<number, number>();
    for (const row of rows) {
      result.set(row.categoryId, Number(row.total ?? 0));
    }
    return result;
  }

  /**
   * Returns sum of RECEIVED income added directly to each wallet (incomes.walletId set),
   * grouped by walletId. Mirrors getExpensesByWalletCents.
   */
  async function getDirectIncomeByWalletCents(userId: number): Promise<Map<number, number>> {
    const rows = await db
      .select({
        walletId: incomes.walletId,
        total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)`,
      })
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, userId),
          eq(incomes.moneyStatus, 'RECEIVED'),
          sql`${incomes.walletId} IS NOT NULL`
        )
      )
      .groupBy(incomes.walletId);

    const result = new Map<number, number>();
    for (const row of rows) {
      if (row.walletId != null) result.set(row.walletId, Number(row.total ?? 0));
    }
    return result;
  }

  /**
   * Returns sum of non-deleted expense amounts grouped by walletId.
   * Only expenses with a wallet assigned (wallet_id NOT NULL) contribute.
   */
  async function getExpensesByWalletCents(userId: number): Promise<Map<number, number>> {
    const rows = await db
      .select({
        walletId: expenses.walletId,
        total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          isNull(expenses.deletedAt),
          sql`${expenses.walletId} IS NOT NULL`
        )
      )
      .groupBy(expenses.walletId);

    const result = new Map<number, number>();
    for (const row of rows) {
      if (row.walletId != null) result.set(row.walletId, Number(row.total ?? 0));
    }
    return result;
  }

  /**
   * Sets income category mappings for a wallet atomically (clear-and-replace).
   * Validates category ownership and cross-wallet conflicts before writing.
   * Skips entirely if the wallet is PF-linked (D-08).
   */
  async function setIncomeCategoryMappings(
    walletId: number,
    userId: number,
    profitMunaAccountId: number | null,
    ids: number[]
  ): Promise<void> {
    // D-08: PF-linked wallets skip income-category mapping
    if (profitMunaAccountId != null) return;
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
        expenseByWallet,
        directIncomeByWallet,
        pmAccountRows,
      ] = await Promise.all([
        db
          .select()
          .from(wallets)
          .where(and(eq(wallets.userId, userId), isNull(wallets.deletedAt)))
          .orderBy(asc(wallets.sortOrder), asc(wallets.id)),
        getTotalReceivedIncomeCents(userId),
        getPerWalletTransactionImpact(userId),
        getMappingsByWallet(userId),
        getReceivedIncomeByCategoryCents(userId),
        getExpensesByWalletCents(userId),
        getDirectIncomeByWalletCents(userId),
        db.select().from(profitMunaAccounts).where(eq(profitMunaAccounts.userId, userId)),
      ]);

      const pmAccountMap = new Map(pmAccountRows.map((a) => [a.id, a]));

      return walletRows.map((wallet) => {
        const mappings = mappingsByWallet.get(wallet.id) ?? {
          incomeCategoryIds: [],
        };
        const txImpact = txImpactByWallet.get(wallet.id) ?? {
          deposits: 0,
          withdrawals: 0,
          activeCount: 0,
        };

        // pmAllocation: only for PF-linked wallets
        let pmAllocation = 0;
        if (wallet.profitMunaAccountId != null) {
          const pmAccount = pmAccountMap.get(wallet.profitMunaAccountId);
          if (pmAccount) {
            pmAllocation = Math.round((totalReceivedIncome * pmAccount.targetPercentage) / 10000);
          }
        }

        // mappedIncome: sum of received income for all mapped income categories
        const mappedIncome = mappings.incomeCategoryIds.reduce(
          (sum, catId) => sum + (incomeByCategory.get(catId) ?? 0),
          0
        );

        // mappedExpenses: sum of non-deleted expenses assigned to this wallet
        const mappedExpenses = expenseByWallet.get(wallet.id) ?? 0;

        // directIncome: RECEIVED income added straight to this wallet (PF off)
        const directIncome = directIncomeByWallet.get(wallet.id) ?? 0;

        const balanceCents = computeBalanceCents({
          pmAllocation,
          mappedIncome,
          mappedExpenses,
          deposits: txImpact.deposits,
          withdrawals: txImpact.withdrawals,
          directIncome,
        });

        const mappingCount = mappings.incomeCategoryIds.length;

        return {
          ...wallet,
          balanceCents,
          transactionCount: txImpact.activeCount,
          mappingCount,
          // D-06: pickers disable categories already mapped to another wallet
          incomeCategoryIds: mappings.incomeCategoryIds,
        };
      });
    },

    hasWalletForPmAccount,

    /**
     * Creates a new wallet for the user. Validates PF link uniqueness.
     * Appends sortOrder = max+1 when not provided (D-03).
     */
    async create(userId: number, input: CreateWalletInput) {
      // Validate PF link uniqueness (WAL-01)
      if (input.profitMunaAccountId != null) {
        const alreadyLinked = await hasWalletForPmAccount(userId, input.profitMunaAccountId);
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
          profitMunaAccountId: input.profitMunaAccountId ?? null,
          color: input.color ?? '#10b981',
          sortOrder,
        })
        .returning();

      // Apply mappings after creation
      if (input.incomeCategoryIds && input.incomeCategoryIds.length > 0) {
        await setIncomeCategoryMappings(
          created.id,
          userId,
          created.profitMunaAccountId,
          input.incomeCategoryIds
        );
      }

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
          wallet.profitMunaAccountId,
          input.incomeCategoryIds
        );
      }

      const [updated] = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      return updated ?? wallet;
    },

    /**
     * Soft-deletes a wallet (sets deletedAt). The Default wallet cannot be deleted (409).
     * On delete: hard-deletes its income-category mappings and nulls profitMunaAccountId so
     * both can re-link to other wallets. Past expenses keep pointing at this wallet (denormalized
     * wallet_name renders without a join). Returns impact counts from before the delete (D-16).
     */
    async remove(walletId: number, userId: number) {
      const rows = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      const wallet = rows[0];
      if (!wallet) throw new HTTPException(404, { message: 'not_found' });
      if (wallet.isDefault) {
        throw new HTTPException(409, { message: 'cannot_delete_default_wallet' });
      }

      // Count non-deleted transactions before delete
      const txCountRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(walletTransactions)
        .where(
          and(eq(walletTransactions.walletId, walletId), isNull(walletTransactions.deletedAt))
        );
      const transactionCount = Number(txCountRows[0]?.count ?? 0);

      // Count income mappings (income-only now)
      const incMappingRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(walletIncomeCategoryMappings)
        .where(eq(walletIncomeCategoryMappings.walletId, walletId));
      const mappingCount = Number(incMappingRows[0]?.count ?? 0);

      // Hard-delete income mappings + null the PF link so both re-link freely (NULLs are
      // distinct in SQLite unique indexes — no clash with the soft-deleted wallet row).
      await db
        .delete(walletIncomeCategoryMappings)
        .where(
          and(
            eq(walletIncomeCategoryMappings.walletId, walletId),
            eq(walletIncomeCategoryMappings.userId, userId)
          )
        );

      // Soft-delete the wallet and free its PF link
      await db
        .update(wallets)
        .set({ deletedAt: new Date().toISOString(), profitMunaAccountId: null })
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));

      return { id: walletId, transactionCount, mappingCount };
    },

    setIncomeCategoryMappings,

    /**
     * Returns wallet detail, balance breakdown, and paginated merged transaction history.
     * History includes soft-deleted rows (D-09); balance excludes them (Pitfall 4).
     * Merge pattern: [income_auto, expense_auto, manual].sort(date DESC, id DESC).slice(page).
     */
    async getById(walletId: number, userId: number, params: { page: number; size: number }) {
      const { page, size } = params;

      // Ownership-scoped wallet fetch
      const rows = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      const wallet = rows[0];
      if (!wallet) throw new HTTPException(404, { message: 'not_found' });

      // Load income mappings for this wallet (income-only now)
      const incomeMappings = await db
        .select({ catId: walletIncomeCategoryMappings.incomeCategoryId })
        .from(walletIncomeCategoryMappings)
        .where(
          and(
            eq(walletIncomeCategoryMappings.walletId, walletId),
            eq(walletIncomeCategoryMappings.userId, userId)
          )
        );

      const incomeCatIds = incomeMappings.map((r) => r.catId);

      // ── Breakdown (balance components) ────────────────────────────────────
      // These queries EXCLUDE soft-deleted transactions (Pitfall 4)

      // pmAllocation: only for PF-linked wallets
      let pmAllocationCents = 0;
      if (wallet.profitMunaAccountId != null) {
        const pmRows = await db
          .select()
          .from(profitMunaAccounts)
          .where(
            and(
              eq(profitMunaAccounts.id, wallet.profitMunaAccountId),
              eq(profitMunaAccounts.userId, userId)
            )
          );
        const pmAccount = pmRows[0];
        if (pmAccount) {
          const totalReceived = await getTotalReceivedIncomeCents(userId);
          pmAllocationCents = Math.round((totalReceived * pmAccount.targetPercentage) / 10000);
        }
      }

      // mappedIncomeCents: sum of RECEIVED incomes for mapped income categories
      let mappedIncomeCents = 0;
      if (incomeCatIds.length > 0) {
        const incomeByCategory = await getReceivedIncomeByCategoryCents(userId);
        mappedIncomeCents = incomeCatIds.reduce(
          (sum, catId) => sum + (incomeByCategory.get(catId) ?? 0),
          0
        );
      }

      // mappedExpensesCents: sum of non-deleted expenses assigned to this wallet
      const expenseByWallet = await getExpensesByWalletCents(userId);
      const mappedExpensesCents = expenseByWallet.get(walletId) ?? 0;

      // directIncomeCents: RECEIVED income added straight to this wallet (PF off)
      const directIncomeSumRows = await db
        .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)` })
        .from(incomes)
        .where(
          and(
            eq(incomes.userId, userId),
            eq(incomes.walletId, walletId),
            eq(incomes.moneyStatus, 'RECEIVED')
          )
        );
      const directIncomeCents = Number(directIncomeSumRows[0]?.total ?? 0);

      // depositsCents + withdrawalsCents: non-deleted manual transactions for this wallet
      const txSumRows = await db
        .select({
          type: walletTransactions.type,
          total: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)`,
        })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId),
            isNull(walletTransactions.deletedAt)
          )
        )
        .groupBy(walletTransactions.type);

      let depositsCents = 0;
      let withdrawalsCents = 0;
      for (const row of txSumRows) {
        if (row.type === 'DEPOSIT') depositsCents = Number(row.total ?? 0);
        else withdrawalsCents = Number(row.total ?? 0);
      }

      // ── Transaction history merge (Pattern 5) ─────────────────────────────
      // fetchLimit caps each source to avoid unbounded reads (Pitfall 3)
      const fetchLimit = (page + 1) * size;

      // Auto-income entries: RECEIVED incomes mapped to this wallet's income categories
      const incomeEntries: Array<{
        id: number;
        type: 'INCOME_AUTO';
        amount: number;
        description: string | null;
        transactionDate: string;
        deletedAt: null;
        source: 'income';
      }> = [];

      if (incomeCatIds.length > 0) {
        const incomeRows = await db
          .select({
            id: incomes.id,
            amount: incomes.amount,
            description: incomes.description,
            transactionDate: incomes.incomeDate,
          })
          .from(incomes)
          .where(
            and(
              eq(incomes.userId, userId),
              inArray(incomes.categoryId, incomeCatIds),
              eq(incomes.moneyStatus, 'RECEIVED'),
              // wallet-linked income is shown under its own wallet (see directIncomeEntries),
              // never under a category-mapped wallet
              isNull(incomes.walletId)
            )
          )
          .orderBy(desc(incomes.incomeDate), desc(incomes.id))
          .limit(fetchLimit);
        for (const row of incomeRows) {
          incomeEntries.push({
            id: row.id,
            type: 'INCOME_AUTO',
            amount: row.amount,
            description: row.description ?? null,
            transactionDate: row.transactionDate,
            deletedAt: null,
            source: 'income',
          });
        }
      }

      // Direct income entries: RECEIVED income added straight to this wallet (PF off).
      // Labeled "Income" in the UI (distinct from INCOME_AUTO allocation rows).
      const directIncomeEntries: Array<{
        id: number;
        type: 'INCOME';
        amount: number;
        description: string | null;
        transactionDate: string;
        deletedAt: null;
        source: 'income';
      }> = [];

      const directIncomeRows = await db
        .select({
          id: incomes.id,
          amount: incomes.amount,
          description: incomes.description,
          transactionDate: incomes.incomeDate,
        })
        .from(incomes)
        .where(
          and(
            eq(incomes.userId, userId),
            eq(incomes.walletId, walletId),
            eq(incomes.moneyStatus, 'RECEIVED')
          )
        )
        .orderBy(desc(incomes.incomeDate), desc(incomes.id))
        .limit(fetchLimit);
      for (const row of directIncomeRows) {
        directIncomeEntries.push({
          id: row.id,
          type: 'INCOME',
          amount: row.amount,
          description: row.description ?? null,
          transactionDate: row.transactionDate,
          deletedAt: null,
          source: 'income',
        });
      }

      // Auto-expense entries: non-deleted expenses assigned to this wallet (by walletId)
      const expenseEntries: Array<{
        id: number;
        type: 'EXPENSE_AUTO';
        amount: number;
        description: string | null;
        transactionDate: string;
        deletedAt: null;
        source: 'expense';
      }> = [];

      const expenseRows = await db
        .select({
          id: expenses.id,
          amount: expenses.amount,
          description: expenses.description,
          transactionDate: expenses.expenseDate,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            eq(expenses.walletId, walletId),
            isNull(expenses.deletedAt)
          )
        )
        .orderBy(desc(expenses.expenseDate), desc(expenses.id))
        .limit(fetchLimit);
      for (const row of expenseRows) {
        expenseEntries.push({
          id: row.id,
          type: 'EXPENSE_AUTO',
          amount: row.amount,
          description: row.description ?? null,
          transactionDate: row.transactionDate,
          deletedAt: null,
          source: 'expense',
        });
      }

      // Manual transactions: ALL (including soft-deleted) for this wallet (D-09)
      const manualRows = await db
        .select()
        .from(walletTransactions)
        .where(
          and(eq(walletTransactions.walletId, walletId), eq(walletTransactions.userId, userId))
        )
        .orderBy(desc(walletTransactions.transactionDate), desc(walletTransactions.id))
        .limit(fetchLimit);

      const manualEntries = manualRows.map((row) => ({
        id: row.id,
        type: row.type as 'DEPOSIT' | 'WITHDRAWAL',
        amount: row.amount,
        description: row.description ?? null,
        transactionDate: row.transactionDate,
        deletedAt: row.deletedAt ?? null,
        source: 'manual' as const,
      }));

      // COUNT(*) per source — independent of the windowed fetch so totalPages is never understated
      const countPromises: Promise<number>[] = [];

      if (incomeCatIds.length > 0) {
        countPromises.push(
          db
            .select({ count: sql<number>`COUNT(*)` })
            .from(incomes)
            .where(
              and(
                eq(incomes.userId, userId),
                inArray(incomes.categoryId, incomeCatIds),
                eq(incomes.moneyStatus, 'RECEIVED'),
                isNull(incomes.walletId)
              )
            )
            .then((r) => Number(r[0]?.count ?? 0))
        );
      } else {
        countPromises.push(Promise.resolve(0));
      }

      // Direct income count: RECEIVED income added straight to this wallet
      countPromises.push(
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(incomes)
          .where(
            and(
              eq(incomes.userId, userId),
              eq(incomes.walletId, walletId),
              eq(incomes.moneyStatus, 'RECEIVED')
            )
          )
          .then((r) => Number(r[0]?.count ?? 0))
      );

      countPromises.push(
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(expenses)
          .where(
            and(
              eq(expenses.userId, userId),
              eq(expenses.walletId, walletId),
              isNull(expenses.deletedAt)
            )
          )
          .then((r) => Number(r[0]?.count ?? 0))
      );

      // Manual: ALL transactions including soft-deleted (D-09)
      countPromises.push(
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(walletTransactions)
          .where(
            and(eq(walletTransactions.walletId, walletId), eq(walletTransactions.userId, userId))
          )
          .then((r) => Number(r[0]?.count ?? 0))
      );

      const [incomeCount, directIncomeCount, expenseCount, manualCount] =
        await Promise.all(countPromises);
      const total =
        (incomeCount ?? 0) + (directIncomeCount ?? 0) + (expenseCount ?? 0) + (manualCount ?? 0);

      // Merge + sort by transactionDate DESC, then id DESC (RESEARCH Pattern 5)
      const merged = [
        ...incomeEntries,
        ...directIncomeEntries,
        ...expenseEntries,
        ...manualEntries,
      ];
      merged.sort((a, b) => {
        if (a.transactionDate < b.transactionDate) return 1;
        if (a.transactionDate > b.transactionDate) return -1;
        return b.id - a.id;
      });

      const totalPages = Math.ceil(total / size) || 1;
      const content = merged.slice(page * size, (page + 1) * size);

      // Rebuild balanceCents using the same formula as list()
      const balanceCents = computeBalanceCents({
        pmAllocation: pmAllocationCents,
        mappedIncome: mappedIncomeCents,
        mappedExpenses: mappedExpensesCents,
        deposits: depositsCents,
        withdrawals: withdrawalsCents,
        directIncome: directIncomeCents,
      });

      return {
        wallet: {
          ...wallet,
          balanceCents,
          transactionCount: manualRows.filter((r) => !r.deletedAt).length,
          mappingCount: incomeCatIds.length,
          // Exact mapping presence — the UI blocked-state hints mirror assertCanInsertTransaction
          incomeCategoryIds: incomeCatIds,
        },
        breakdown: {
          pmAllocationCents,
          mappedIncomeCents,
          mappedExpensesCents,
          depositsCents,
          withdrawalsCents,
          directIncomeCents,
        },
        transactions: content,
        pagination: { page, size, total, totalPages },
      };
    },

    /**
     * Creates a manual transaction on an eligible wallet.
     * Runs assertCanInsertTransaction before insert (T-04-12).
     * Amount must be positive cents.
     */
    async createTransaction(walletId: number, userId: number, input: CreateTransactionInput) {
      // Ownership-scoped wallet fetch
      const walletRows = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
      const wallet = walletRows[0];
      if (!wallet) throw new HTTPException(404, { message: 'not_found' });

      // Load income mappings for the DEPOSIT blocking guard (income-only now)
      const incomeMappings = await db
        .select({ catId: walletIncomeCategoryMappings.incomeCategoryId })
        .from(walletIncomeCategoryMappings)
        .where(
          and(
            eq(walletIncomeCategoryMappings.walletId, walletId),
            eq(walletIncomeCategoryMappings.userId, userId)
          )
        );

      // Run blocking guard (T-04-12, T-04-13)
      assertCanInsertTransaction(input.type, wallet, {
        incomeCategories: incomeMappings.map((r) => r.catId),
      });

      const amountCents = Math.round(input.amount);
      if (amountCents <= 0) {
        throw new HTTPException(400, { message: 'amount_must_be_positive' });
      }

      const [created] = await db
        .insert(walletTransactions)
        .values({
          walletId,
          userId,
          type: input.type,
          amount: amountCents,
          description: input.description ?? null,
          transactionDate: input.transactionDate,
        })
        .returning();

      return created;
    },

    /**
     * Updates mutable fields of a manual transaction (ownership-scoped).
     * Returns the updated row.
     */
    async updateTransaction(
      walletId: number,
      txId: number,
      userId: number,
      input: UpdateTransactionInput
    ) {
      // Ownership-scoped fetch
      const rows = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.id, txId),
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId)
          )
        );
      const tx = rows[0];
      if (!tx) throw new HTTPException(404, { message: 'not_found' });

      const updateData: Partial<typeof tx> = {};
      if (input.amount !== undefined) updateData.amount = Math.round(input.amount);
      if (input.description !== undefined) updateData.description = input.description;
      if (input.transactionDate !== undefined) updateData.transactionDate = input.transactionDate;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(walletTransactions)
          .set(updateData)
          .where(
            and(
              eq(walletTransactions.id, txId),
              eq(walletTransactions.walletId, walletId),
              eq(walletTransactions.userId, userId)
            )
          );
      }

      const [updated] = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.id, txId),
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId)
          )
        );
      return updated ?? tx;
    },

    /**
     * Soft-deletes a manual transaction by setting deletedAt (ownership-scoped).
     */
    async removeTransaction(walletId: number, txId: number, userId: number) {
      const rows = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.id, txId),
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId)
          )
        );
      if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });

      const deletedAt = new Date().toISOString();
      await db
        .update(walletTransactions)
        .set({ deletedAt })
        .where(
          and(
            eq(walletTransactions.id, txId),
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId)
          )
        );

      const [updated] = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, txId));
      return updated ?? { ...rows[0], deletedAt };
    },

    /**
     * Restores a soft-deleted transaction by clearing deletedAt (ownership-scoped).
     */
    async restoreTransaction(walletId: number, txId: number, userId: number) {
      const rows = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.id, txId),
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId)
          )
        );
      if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });

      await db
        .update(walletTransactions)
        .set({ deletedAt: null })
        .where(
          and(
            eq(walletTransactions.id, txId),
            eq(walletTransactions.walletId, walletId),
            eq(walletTransactions.userId, userId)
          )
        );

      const [updated] = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, txId));
      return updated ?? { ...rows[0], deletedAt: null };
    },
  };
}
