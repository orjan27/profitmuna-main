import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { createWalletService } from '@/services/wallet-service';
import { createIncomeService } from '@/services/income-service';
import { createTestDb, seedUser } from './helpers/db';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedPfAccount(
  db: ReturnType<typeof createTestDb>['db'],
  userId: number,
  overrides: Partial<{
    name: string;
    targetPercentage: number;
    color: string;
    accountType: 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';
    sortOrder: number;
  }> = {}
) {
  const [row] = db
    .insert(schema.profitFirstAccounts)
    .values({
      userId,
      name: overrides.name ?? 'Profit',
      targetPercentage: overrides.targetPercentage ?? 500, // 5%
      color: '#10b981',
      accountType: overrides.accountType ?? 'PROFIT',
      sortOrder: overrides.sortOrder ?? 0,
    })
    .returning()
    .all();
  return row;
}

function seedIncomeCategory(
  db: ReturnType<typeof createTestDb>['db'],
  userId: number,
  name = 'Consulting'
) {
  const [row] = db
    .insert(schema.incomeCategories)
    .values({ userId, name, system: false })
    .returning()
    .all();
  return row;
}

function seedExpenseCategory(
  db: ReturnType<typeof createTestDb>['db'],
  userId: number,
  name = 'Rent'
) {
  const [row] = db
    .insert(schema.expenseCategories)
    .values({ userId, name, system: false })
    .returning()
    .all();
  return row;
}

function seedIncome(
  db: ReturnType<typeof createTestDb>['db'],
  userId: number,
  categoryId: number,
  amount: number,
  moneyStatus: 'RECEIVED' | 'PENDING' = 'RECEIVED'
) {
  const [row] = db
    .insert(schema.incomes)
    .values({
      userId,
      categoryId,
      categoryName: 'Test Category',
      amount,
      incomeDate: '2026-01-01',
      moneyStatus,
      profitFirstAllocated: true,
    })
    .returning()
    .all();
  return row;
}

/**
 * Seeds an expense assigned to a wallet (the new deduction model).
 * walletId may be null to mirror legacy pre-migration rows.
 */
function seedExpense(
  db: ReturnType<typeof createTestDb>['db'],
  userId: number,
  categoryId: number,
  amount: number,
  walletId: number | null,
  deletedAt: string | null = null,
  expenseDate = '2026-01-01'
) {
  const [row] = db
    .insert(schema.expenses)
    .values({
      userId,
      categoryId,
      categoryName: 'Test Expense',
      amount,
      expenseDate,
      walletId,
      walletName: null,
      deletedAt,
    })
    .returning()
    .all();
  return row;
}

// ─── WAL-01: wallet CRUD ──────────────────────────────────────────────────────

describe('wallets service', () => {
  describe('WAL-01: wallet CRUD', () => {
    it('creates a PF-linked wallet linked to a PF account', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01a@test.com', name: 'User A', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Profit Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      expect(wallet.name).toBe('Profit Wallet');
      expect(wallet.profitFirstAccountId).toBe(pfAccount.id);
      expect(wallet.userId).toBe(user.id);
    });

    it('creates a standalone wallet without a PF account link', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01b@test.com', name: 'User B', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Blank Wallet',
        color: '#8b5cf6',
      });

      expect(wallet.name).toBe('Blank Wallet');
      expect(wallet.profitFirstAccountId).toBeNull();
    });

    it('returns 409 when the same PF account is already linked to another wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01c@test.com', name: 'User C', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      await svc.create(user.id, {
        name: 'First Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      await expect(
        svc.create(user.id, {
          name: 'Second Wallet',
          profitFirstAccountId: pfAccount.id,
          color: '#8b5cf6',
        })
      ).rejects.toMatchObject({ status: 409, message: 'wallet_pf_account_already_linked' });
    });

    it('lists wallets with computed balanceCents, transactionCount, and mappingCount', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01d@test.com', name: 'User D', emailVerified: true });

      const svc = createWalletService(dbD1);
      await svc.create(user.id, { name: 'W1', color: '#10b981' });
      await svc.create(user.id, { name: 'W2', color: '#8b5cf6' });

      const wallets = await svc.list(user.id);
      expect(wallets).toHaveLength(2);
      expect(wallets[0]).toHaveProperty('balanceCents');
      expect(wallets[0]).toHaveProperty('transactionCount');
      expect(wallets[0]).toHaveProperty('mappingCount');
      expect(wallets[0]).toHaveProperty('isDefault');
    });

    it('updates wallet name, color, and sortOrder', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01e@test.com', name: 'User E', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Old Name',
        color: '#10b981',
      });

      const updated = await svc.update(wallet.id, user.id, {
        name: 'New Name',
        color: '#f59e0b',
        sortOrder: 5,
      });

      expect(updated.name).toBe('New Name');
      expect(updated.color).toBe('#f59e0b');
      expect(updated.sortOrder).toBe(5);
    });

    it('soft-deletes a wallet: sets deletedAt, excludes from list, keeps impact-count shape (D-16)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01f@test.com', name: 'User F', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'To Delete',
        color: '#10b981',
      });

      const result = await svc.remove(wallet.id, user.id);
      expect(result.id).toBe(wallet.id);
      expect(result).toHaveProperty('transactionCount');
      expect(result).toHaveProperty('mappingCount');

      // Soft-deleted wallet is excluded from the active list
      const wallets = await svc.list(user.id);
      expect(wallets).toHaveLength(0);

      // deletedAt is set in the DB
      const row = db.select().from(schema.wallets).where(eq(schema.wallets.id, wallet.id)).all()[0];
      expect(row.deletedAt).not.toBeNull();
    });

    it('soft-delete unlinks income mappings and nulls the PF link so both re-link freely', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01g@test.com', name: 'User G', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);
      const incCat = seedIncomeCategory(db, user.id, 'Consulting');

      const svc = createWalletService(dbD1);
      // PF-linked wallets skip income mapping (D-08), so map income on a separate standalone wallet
      const pfWallet = await svc.create(user.id, {
        name: 'PF Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });
      const incomeWallet = await svc.create(user.id, {
        name: 'Income Wallet',
        color: '#8b5cf6',
        incomeCategoryIds: [incCat.id],
      });

      // Delete the income-mapped wallet → its income mappings are hard-deleted
      await svc.remove(incomeWallet.id, user.id);
      const incMappings = db
        .select()
        .from(schema.walletIncomeCategoryMappings)
        .where(eq(schema.walletIncomeCategoryMappings.walletId, incomeWallet.id))
        .all();
      expect(incMappings).toHaveLength(0);

      // Delete the PF wallet → profitFirstAccountId is nulled
      await svc.remove(pfWallet.id, user.id);
      const pfRow = db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, pfWallet.id))
        .all()[0];
      expect(pfRow.profitFirstAccountId).toBeNull();

      // The freed income category can be remapped to a new wallet
      const relinked = await svc.create(user.id, {
        name: 'Relinked',
        color: '#f59e0b',
        incomeCategoryIds: [incCat.id],
      });
      const relinkedRows = db
        .select()
        .from(schema.walletIncomeCategoryMappings)
        .where(eq(schema.walletIncomeCategoryMappings.walletId, relinked.id))
        .all();
      expect(relinkedRows).toHaveLength(1);
    });

    it('returns 409 cannot_delete_default_wallet when deleting the Default wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01h@test.com', name: 'User H', emailVerified: true });

      const [defaultWallet] = db
        .insert(schema.wallets)
        .values({
          name: 'Default',
          userId: user.id,
          isDefault: true,
          color: '#10b981',
          sortOrder: 0,
        })
        .returning()
        .all();

      const svc = createWalletService(dbD1);
      await expect(svc.remove(defaultWallet.id, user.id)).rejects.toMatchObject({
        status: 409,
        message: 'cannot_delete_default_wallet',
      });
    });
  });

  // ─── WAL-02: income category mappings ─────────────────────────────────────

  describe('WAL-02: income category mappings', () => {
    it('maps income categories to a wallet on create', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02a@test.com', name: 'User A', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Consulting');

      const svc = createWalletService(dbD1);
      await svc.create(user.id, {
        name: 'Mapped Wallet',
        color: '#10b981',
        incomeCategoryIds: [incCat.id],
      });

      const rows = db
        .select()
        .from(schema.walletIncomeCategoryMappings)
        .where(eq(schema.walletIncomeCategoryMappings.userId, user.id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0].incomeCategoryId).toBe(incCat.id);
    });

    it('returns 409 when an income category is already mapped to another wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02b@test.com', name: 'User B', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Freelance');

      const svc = createWalletService(dbD1);
      await svc.create(user.id, {
        name: 'First Wallet',
        color: '#10b981',
        incomeCategoryIds: [incCat.id],
      });

      await expect(
        svc.create(user.id, {
          name: 'Second Wallet',
          color: '#8b5cf6',
          incomeCategoryIds: [incCat.id],
        })
      ).rejects.toMatchObject({ status: 409, message: 'income_category_already_mapped' });
    });

    it('replaces existing income category mappings atomically on update', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02g@test.com', name: 'User G', emailVerified: true });
      const cat1 = seedIncomeCategory(db, user.id, 'Cat1');
      const cat2 = seedIncomeCategory(db, user.id, 'Cat2');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Replace Wallet',
        color: '#10b981',
        incomeCategoryIds: [cat1.id],
      });

      // Replace with cat2 only
      await svc.update(wallet.id, user.id, {
        incomeCategoryIds: [cat2.id],
      });

      const rows = db
        .select()
        .from(schema.walletIncomeCategoryMappings)
        .where(eq(schema.walletIncomeCategoryMappings.walletId, wallet.id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0].incomeCategoryId).toBe(cat2.id);
    });

    it('mappingCount counts income mappings only', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02m@test.com', name: 'User M', emailVerified: true });
      const cat1 = seedIncomeCategory(db, user.id, 'A');
      const cat2 = seedIncomeCategory(db, user.id, 'B');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Counted Wallet',
        color: '#10b981',
        incomeCategoryIds: [cat1.id, cat2.id],
      });

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;
      expect(listed.mappingCount).toBe(2);
    });

    it('rejects income category not belonging to the authenticated user (T-04-07)', async () => {
      const { dbD1, db } = createTestDb();
      const user1 = seedUser(db, {
        email: 'wal02i-u1@test.com',
        name: 'User 1',
        emailVerified: true,
      });
      const user2 = seedUser(db, {
        email: 'wal02i-u2@test.com',
        name: 'User 2',
        emailVerified: true,
      });
      // Cat belongs to user2, not user1
      const cat = seedIncomeCategory(db, user2.id, 'Other User Cat');

      const svc = createWalletService(dbD1);
      await expect(
        svc.create(user1.id, {
          name: 'Bad Wallet',
          color: '#10b981',
          incomeCategoryIds: [cat.id],
        })
      ).rejects.toMatchObject({ status: 403 });
    });

    it('PF-linked wallet does not apply income mappings (D-08)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02k@test.com', name: 'User K', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);
      const incCat = seedIncomeCategory(db, user.id, 'Salary');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
        incomeCategoryIds: [incCat.id], // should be ignored for PF wallets
      });

      const rows = db
        .select()
        .from(schema.walletIncomeCategoryMappings)
        .where(eq(schema.walletIncomeCategoryMappings.walletId, wallet.id))
        .all();
      // PF wallets skip income mapping (D-08)
      expect(rows).toHaveLength(0);
    });
  });

  // ─── WAL-03: derived balance computation ─────────────────────────────────

  describe('WAL-03: derived balance computation', () => {
    it('balance deducts expenses assigned to the wallet by walletId', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03a@test.com', name: 'User A', emailVerified: true });

      // PF account with 10% (1000 bp)
      const pfAccount = seedPfAccount(db, user.id, { targetPercentage: 1000 });
      const incCat = seedIncomeCategory(db, user.id);
      const expCat = seedExpenseCategory(db, user.id);

      // Seed income: 10000 cents received
      seedIncome(db, user.id, incCat.id, 10000, 'RECEIVED');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      // Expense assigned to THIS wallet: 500 cents
      seedExpense(db, user.id, expCat.id, 500, wallet.id);

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;

      // pfAllocation = Math.round(10000 * 1000 / 10000) = 1000
      // mappedExpenses (by walletId) = 500
      // balance = 1000 + 0 - 500 + 0 - 0 = 500
      expect(listed.balanceCents).toBe(500);
    });

    it('expenses assigned to a different wallet do not affect this wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03x@test.com', name: 'User X', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id);

      const svc = createWalletService(dbD1);
      const walletA = await svc.create(user.id, { name: 'A', color: '#10b981' });
      const walletB = await svc.create(user.id, { name: 'B', color: '#8b5cf6' });

      // Expense assigned to wallet B only
      seedExpense(db, user.id, expCat.id, 4000, walletB.id);

      const wallets = await svc.list(user.id);
      const a = wallets.find((w) => w.id === walletA.id)!;
      const b = wallets.find((w) => w.id === walletB.id)!;

      expect(a.balanceCents).toBe(0);
      expect(b.balanceCents).toBe(-4000);
    });

    it('legacy NULL-wallet expenses deduct from nothing', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03y@test.com', name: 'User Y', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, { name: 'W', color: '#10b981' });

      // Legacy expense with no wallet assigned
      seedExpense(db, user.id, expCat.id, 9999, null);

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;
      expect(listed.balanceCents).toBe(0);
    });

    it('allows negative balance (no clamp — D-13)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03b@test.com', name: 'User B', emailVerified: true });

      const expCat = seedExpenseCategory(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Negative',
        color: '#f43f5e',
      });
      seedExpense(db, user.id, expCat.id, 5000, wallet.id);

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;

      // 0 - 5000 = -5000 (not clamped)
      expect(listed.balanceCents).toBe(-5000);
      expect(listed.balanceCents).toBeLessThan(0);
    });

    it('soft-deleted expenses are excluded from the wallet balance', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03z@test.com', name: 'User Z', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, { name: 'W', color: '#10b981' });

      seedExpense(db, user.id, expCat.id, 3000, wallet.id);
      seedExpense(db, user.id, expCat.id, 1000, wallet.id, '2026-01-02T00:00:00Z');

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;
      // Only the non-deleted 3000 deducts
      expect(listed.balanceCents).toBe(-3000);
    });

    it('pfAllocation is basis-point ratio of total RECEIVED income for PF-linked wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03c@test.com', name: 'User C', emailVerified: true });

      const pfAccount = seedPfAccount(db, user.id, { targetPercentage: 500 }); // 5%
      const incCat = seedIncomeCategory(db, user.id);

      // 100000 cents received
      seedIncome(db, user.id, incCat.id, 100000, 'RECEIVED');
      // This one is PENDING — should NOT contribute to pfAllocation
      seedIncome(db, user.id, incCat.id, 50000, 'PENDING');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;

      // pfAllocation = Math.round(100000 * 500 / 10000) = 5000
      expect(listed.balanceCents).toBe(5000);
    });

    it('BLANK wallet has pfAllocation=0 regardless of income records', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03d@test.com', name: 'User D', emailVerified: true });

      const incCat = seedIncomeCategory(db, user.id);
      seedIncome(db, user.id, incCat.id, 100000, 'RECEIVED');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Blank',
        color: '#8b5cf6',
      });

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;

      expect(listed.balanceCents).toBe(0);
    });

    it('list() orders wallets by sortOrder then id', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03e@test.com', name: 'User E', emailVerified: true });

      const svc = createWalletService(dbD1);
      const w3 = await svc.create(user.id, {
        name: 'W3',
        color: '#10b981',
        sortOrder: 10,
      });
      const w1 = await svc.create(user.id, {
        name: 'W1',
        color: '#8b5cf6',
        sortOrder: 0,
      });
      const w2 = await svc.create(user.id, {
        name: 'W2',
        color: '#f59e0b',
        sortOrder: 5,
      });

      const wallets = await svc.list(user.id);
      expect(wallets.map((w) => w.name)).toEqual(['W1', 'W2', 'W3']);
      expect(wallets[0].id).toBe(w1.id);
      expect(wallets[1].id).toBe(w2.id);
      expect(wallets[2].id).toBe(w3.id);
    });

    it('transactionCount reflects non-deleted wallet_transactions', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03f@test.com', name: 'User F', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'W',
        color: '#10b981',
      });

      // Seed 2 transactions directly
      db.insert(schema.walletTransactions)
        .values({
          walletId: wallet.id,
          userId: user.id,
          type: 'DEPOSIT',
          amount: 1000,
          transactionDate: '2026-01-01',
        })
        .run();
      db.insert(schema.walletTransactions)
        .values({
          walletId: wallet.id,
          userId: user.id,
          type: 'WITHDRAWAL',
          amount: 500,
          transactionDate: '2026-01-02',
          deletedAt: '2026-01-02T00:00:00Z',
        })
        .run();

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;
      // Only non-deleted transactions count
      expect(listed.transactionCount).toBe(1);
    });
  });

  // ─── WAL-04: manual transaction guard ────────────────────────────────────

  describe('WAL-04: manual transaction guard (assertCanInsertTransaction)', () => {
    it('blocks manual DEPOSIT on a PF-linked wallet (manual_deposit_blocked_pf_wallet)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04a@test.com', name: 'User A', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      await expect(
        svc.createTransaction(wallet.id, user.id, {
          type: 'DEPOSIT',
          amount: 1000,
          transactionDate: '2026-01-01',
        })
      ).rejects.toMatchObject({ status: 400, message: 'manual_deposit_blocked_pf_wallet' });
    });

    it('blocks manual DEPOSIT on a wallet with mapped income categories (manual_deposit_blocked_income_mapped)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04b@test.com', name: 'User B', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Consulting');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Mapped Wallet',
        color: '#8b5cf6',
        incomeCategoryIds: [incCat.id],
      });

      await expect(
        svc.createTransaction(wallet.id, user.id, {
          type: 'DEPOSIT',
          amount: 500,
          transactionDate: '2026-01-01',
        })
      ).rejects.toMatchObject({ status: 400, message: 'manual_deposit_blocked_income_mapped' });
    });

    it('allows manual WITHDRAWAL on a PF-linked wallet (withdrawal guard dropped)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04e@test.com', name: 'User E', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Withdrawal Wallet',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'WITHDRAWAL',
        amount: 500,
        transactionDate: '2026-01-01',
        description: 'Profit distribution',
      });

      expect(tx.type).toBe('WITHDRAWAL');
      expect(tx.amount).toBe(500);
      expect(tx.walletId).toBe(wallet.id);
    });

    it('allows manual WITHDRAWAL on an income-mapped wallet (withdrawal guard dropped)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04g@test.com', name: 'User G', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Salary');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Income Wallet',
        color: '#8b5cf6',
        incomeCategoryIds: [incCat.id],
      });

      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'WITHDRAWAL',
        amount: 300,
        transactionDate: '2026-01-01',
      });

      expect(tx.type).toBe('WITHDRAWAL');
      expect(tx.amount).toBe(300);
    });

    it('creates and updates manual transactions on eligible wallets', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04f@test.com', name: 'User F', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Blank Wallet',
        color: '#3b82f6',
      });

      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'DEPOSIT',
        amount: 1000,
        transactionDate: '2026-01-01',
        description: 'Initial deposit',
      });

      expect(tx.amount).toBe(1000);
      expect(tx.type).toBe('DEPOSIT');
      expect(tx.description).toBe('Initial deposit');
      expect(tx.deletedAt).toBeNull();

      // Update
      const updated = await svc.updateTransaction(wallet.id, tx.id, user.id, {
        amount: 2000,
        description: 'Updated deposit',
        transactionDate: '2026-01-02',
      });

      expect(updated.amount).toBe(2000);
      expect(updated.description).toBe('Updated deposit');
      expect(updated.transactionDate).toBe('2026-01-02');
    });
  });

  // ─── WAL-05: transaction soft-delete and restore ─────────────────────────

  describe('WAL-05: transaction soft-delete and restore', () => {
    it('soft-delete sets deletedAt to ISO timestamp (null before delete)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05a@test.com', name: 'User A', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Wallet',
        color: '#10b981',
      });

      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'DEPOSIT',
        amount: 500,
        transactionDate: '2026-01-01',
      });

      expect(tx.deletedAt).toBeNull();

      const removed = await svc.removeTransaction(wallet.id, tx.id, user.id);
      expect(removed.deletedAt).not.toBeNull();
      expect(typeof removed.deletedAt).toBe('string');
    });

    it('restore clears deletedAt back to null', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05b@test.com', name: 'User B', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Wallet',
        color: '#8b5cf6',
      });

      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'DEPOSIT',
        amount: 500,
        transactionDate: '2026-01-01',
      });

      await svc.removeTransaction(wallet.id, tx.id, user.id);
      const restored = await svc.restoreTransaction(wallet.id, tx.id, user.id);
      expect(restored.deletedAt).toBeNull();
    });

    it('soft-deleted transactions appear in paginated history (D-09)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05c@test.com', name: 'User C', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Wallet',
        color: '#f59e0b',
      });

      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'DEPOSIT',
        amount: 500,
        transactionDate: '2026-01-01',
      });

      await svc.removeTransaction(wallet.id, tx.id, user.id);

      // D-09: deleted transactions MUST appear in history
      const detail = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });
      const found = detail.transactions.find((t) => t.id === tx.id);
      expect(found).toBeDefined();
      expect(found!.deletedAt).not.toBeNull();
    });

    it('balance computation excludes soft-deleted transactions', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05d@test.com', name: 'User D', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Wallet',
        color: '#f43f5e',
      });

      // Deposit 1000 then soft-delete it
      const tx = await svc.createTransaction(wallet.id, user.id, {
        type: 'DEPOSIT',
        amount: 1000,
        transactionDate: '2026-01-01',
      });

      // Before delete: balance should include the deposit
      const beforeDelete = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });
      expect(beforeDelete.breakdown.depositsCents).toBe(1000);

      await svc.removeTransaction(wallet.id, tx.id, user.id);

      // After delete: balance should exclude it (Pitfall 4)
      const afterDelete = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });
      expect(afterDelete.breakdown.depositsCents).toBe(0);
    });

    it('EXPENSE_AUTO history is sourced by walletId, deducts in the breakdown', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05e@test.com', name: 'User E', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Salary');
      const expCat = seedExpenseCategory(db, user.id, 'Rent');

      // Seed income mapped to the wallet
      const income = seedIncome(db, user.id, incCat.id, 5000, 'RECEIVED');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Full Wallet',
        color: '#14b8a6',
        incomeCategoryIds: [incCat.id],
      });

      // Expense assigned to THIS wallet by walletId
      const expense = seedExpense(db, user.id, expCat.id, 2000, wallet.id, null, '2026-01-10');

      // Seed a manual transaction directly (income mapping blocks createTransaction DEPOSIT)
      db.insert(schema.walletTransactions)
        .values({
          walletId: wallet.id,
          userId: user.id,
          type: 'DEPOSIT',
          amount: 750,
          transactionDate: '2026-01-15',
        })
        .run();

      const detail = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });

      // Should have entries from all 3 sources
      const sources = detail.transactions.map((t) => t.source);
      expect(sources).toContain('manual');
      expect(sources).toContain('income');
      expect(sources).toContain('expense');

      // The expense deducts in the breakdown
      expect(detail.breakdown.mappedExpensesCents).toBe(2000);

      // Verify income and expense records used in test
      expect(income.amount).toBe(5000);
      expect(expense.amount).toBe(2000);

      // Verify the transactions are sorted desc by transactionDate
      for (let i = 1; i < detail.transactions.length; i++) {
        const prev = detail.transactions[i - 1];
        const curr = detail.transactions[i];
        expect(prev.transactionDate >= curr.transactionDate).toBe(true);
      }
    });

    it('getById still returns detail for a soft-deleted wallet (history links keep working)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05i@test.com', name: 'User I', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, { name: 'Soon Gone', color: '#10b981' });
      await svc.remove(wallet.id, user.id);

      const detail = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });
      expect(detail.wallet.id).toBe(wallet.id);
      expect(detail.wallet.deletedAt).not.toBeNull();
    });

    it('getById returns 404 for another user wallet (ownership-scoped)', async () => {
      const { dbD1, db } = createTestDb();
      const user1 = seedUser(db, {
        email: 'wal05f1@test.com',
        name: 'User 1',
        emailVerified: true,
      });
      const user2 = seedUser(db, {
        email: 'wal05f2@test.com',
        name: 'User 2',
        emailVerified: true,
      });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user1.id, {
        name: 'Private Wallet',
        color: '#10b981',
      });

      await expect(svc.getById(wallet.id, user2.id, { page: 0, size: 20 })).rejects.toMatchObject({
        status: 404,
        message: 'not_found',
      });
    });

    it('two-page income history: page 0 returns 20 newest rows in DESC order, page 1 returns remaining 10 with no overlap', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, {
        email: 'wal05g@test.com',
        name: 'User G',
        emailVerified: true,
      });
      const incCat = seedIncomeCategory(db, user.id, 'Freelance');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Volume Wallet',
        color: '#6366f1',
        incomeCategoryIds: [incCat.id],
      });

      // Insert 30 RECEIVED incomes with distinct ascending dates so ordering is observable
      const insertedIds: number[] = [];
      for (let i = 1; i <= 30; i++) {
        const day = String(i).padStart(2, '0');
        const [row] = db
          .insert(schema.incomes)
          .values({
            userId: user.id,
            categoryId: incCat.id,
            categoryName: 'Freelance',
            amount: i * 100,
            incomeDate: `2026-01-${day}`,
            moneyStatus: 'RECEIVED',
            profitFirstAllocated: true,
          })
          .returning()
          .all();
        insertedIds.push(row.id);
      }

      const page0 = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });
      const page1 = await svc.getById(wallet.id, user.id, { page: 1, size: 20 });

      // pagination.total must equal the true count (30), not the truncated merge
      expect(page0.pagination.total).toBe(30);
      expect(page0.pagination.totalPages).toBe(2);

      // page 0: exactly 20 rows
      expect(page0.transactions).toHaveLength(20);
      // all rows are income source
      expect(page0.transactions.every((t) => t.source === 'income')).toBe(true);
      // first row must be the newest date (2026-01-30)
      expect(page0.transactions[0].transactionDate).toBe('2026-01-30');
      // rows are in strict DESC order
      for (let i = 1; i < page0.transactions.length; i++) {
        expect(
          page0.transactions[i - 1].transactionDate >= page0.transactions[i].transactionDate
        ).toBe(true);
      }

      // page 1: exactly 10 rows
      expect(page1.transactions).toHaveLength(10);
      // last row on page 1 must be the oldest date (2026-01-01)
      expect(page1.transactions[page1.transactions.length - 1].transactionDate).toBe('2026-01-01');

      // no overlap between page 0 and page 1 ids
      const page0Ids = new Set(page0.transactions.map((t) => t.id));
      const page1Ids = page1.transactions.map((t) => t.id);
      for (const id of page1Ids) {
        expect(page0Ids.has(id)).toBe(false);
      }

      // union of page0 + page1 covers all 30 distinct rows
      const allIds = new Set([...page0.transactions.map((t) => t.id), ...page1Ids]);
      expect(allIds.size).toBe(30);
    });

    it('wallet expense history by walletId returns each expense once and total equals true count', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, {
        email: 'wal05h@test.com',
        name: 'User H',
        emailVerified: true,
      });
      const cat1 = seedExpenseCategory(db, user.id, 'Office');
      const cat2 = seedExpenseCategory(db, user.id, 'Travel');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Spending Wallet',
        color: '#f97316',
      });

      // 5 expenses in cat1, 5 in cat2 = 10 total, all assigned to this wallet
      for (let i = 1; i <= 5; i++) {
        const day = String(i).padStart(2, '0');
        seedExpense(db, user.id, cat1.id, i * 50, wallet.id, null, `2026-02-${day}`);
        seedExpense(
          db,
          user.id,
          cat2.id,
          i * 75,
          wallet.id,
          null,
          `2026-02-${String(i + 10).padStart(2, '0')}`
        );
      }

      const detail = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });

      // All 10 expenses are returned exactly once
      const expenseRows = detail.transactions.filter((t) => t.source === 'expense');
      expect(expenseRows).toHaveLength(10);

      // IDs are unique — no duplicate rows
      const expenseIds = expenseRows.map((t) => t.id);
      const uniqueIds = new Set(expenseIds);
      expect(uniqueIds.size).toBe(10);

      // total reflects the true count
      expect(detail.pagination.total).toBe(10);
    });
  });

  // ─── WAL: direct wallet income (PF allocation top-up) ───────────────────────
  describe('WAL: direct wallet income (PF allocation top-up)', () => {
    it('records a PF-wallet top-up as income with Profit First forced off', async () => {
      const { db, dbD1 } = createTestDb();
      const user = seedUser(db, { email: 'wdi-a@test.com', name: 'User A', emailVerified: true });
      const pf = seedPfAccount(db, user.id, { targetPercentage: 500 });
      const cat = seedIncomeCategory(db, user.id, 'Bonus');
      const walletSvc = createWalletService(dbD1);
      const incomeSvc = createIncomeService(dbD1);

      const wallet = await walletSvc.create(user.id, {
        name: 'Profit',
        profitFirstAccountId: pf.id,
      });

      // Caller passes profitFirstAllocated:true — the service must force it off.
      const income = await incomeSvc.create(user.id, {
        categoryId: cat.id,
        amount: 100000,
        incomeDate: '2026-03-01',
        moneyStatus: 'RECEIVED',
        profitFirstAllocated: true,
        walletId: wallet.id,
      });

      expect(income.profitFirstAllocated).toBe(false);
      expect(income.walletId).toBe(wallet.id);
      expect(income.walletName).toBe('Profit');
    });

    it('credits the PF wallet as Income without splitting across allocations', async () => {
      const { db, dbD1 } = createTestDb();
      const user = seedUser(db, { email: 'wdi-b@test.com', name: 'User B', emailVerified: true });
      const pf = seedPfAccount(db, user.id, { targetPercentage: 500 });
      const cat = seedIncomeCategory(db, user.id, 'Bonus');
      const walletSvc = createWalletService(dbD1);
      const incomeSvc = createIncomeService(dbD1);

      const wallet = await walletSvc.create(user.id, {
        name: 'Profit',
        profitFirstAccountId: pf.id,
      });
      await incomeSvc.create(user.id, {
        categoryId: cat.id,
        amount: 100000,
        incomeDate: '2026-03-01',
        moneyStatus: 'RECEIVED',
        walletId: wallet.id,
      });

      const detail = await walletSvc.getById(wallet.id, user.id, { page: 0, size: 20 });

      // Full amount lands in this wallet; PF allocation pool stays 0 (income is PF-off).
      expect(detail.breakdown.directIncomeCents).toBe(100000);
      expect(detail.breakdown.pfAllocationCents).toBe(0);
      expect(detail.wallet.balanceCents).toBe(100000);

      const incomeRows = detail.transactions.filter((t) => t.type === 'INCOME');
      expect(incomeRows).toHaveLength(1);
      expect(incomeRows[0]!.amount).toBe(100000);
    });

    it('does not double-count wallet-linked income into a category-mapped wallet', async () => {
      const { db, dbD1 } = createTestDb();
      const user = seedUser(db, { email: 'wdi-c@test.com', name: 'User C', emailVerified: true });
      const pf = seedPfAccount(db, user.id, { targetPercentage: 500 });
      const cat = seedIncomeCategory(db, user.id, 'Bonus');
      const walletSvc = createWalletService(dbD1);
      const incomeSvc = createIncomeService(dbD1);

      const pfWallet = await walletSvc.create(user.id, {
        name: 'Profit',
        profitFirstAccountId: pf.id,
      });
      // Standalone wallet mapped to the SAME category the top-up uses.
      const mapped = await walletSvc.create(user.id, {
        name: 'Mapped',
        incomeCategoryIds: [cat.id],
      });

      await incomeSvc.create(user.id, {
        categoryId: cat.id,
        amount: 100000,
        incomeDate: '2026-03-01',
        moneyStatus: 'RECEIVED',
        walletId: pfWallet.id,
      });

      const wallets = await walletSvc.list(user.id);
      const mappedBalance = wallets.find((w) => w.id === mapped.id)!.balanceCents;
      // The wallet-linked income belongs to the PF wallet only — not the mapped wallet.
      expect(mappedBalance).toBe(0);
    });
  });
});
