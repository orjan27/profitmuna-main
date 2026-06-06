import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { createWalletService } from '@/services/wallet-service';
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

function seedExpense(
  db: ReturnType<typeof createTestDb>['db'],
  userId: number,
  categoryId: number,
  amount: number,
  deletedAt: string | null = null
) {
  const [row] = db
    .insert(schema.expenses)
    .values({
      userId,
      categoryId,
      categoryName: 'Test Expense',
      amount,
      expenseDate: '2026-01-01',
      deletedAt,
    })
    .returning()
    .all();
  return row;
}

// ─── WAL-01: wallet CRUD ──────────────────────────────────────────────────────

describe('wallets service', () => {
  describe('WAL-01: wallet CRUD', () => {
    it('creates a PROFIT_FIRST wallet linked to a PF account', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01a@test.com', name: 'User A', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Profit Wallet',
        sourceType: 'PROFIT_FIRST',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      expect(wallet.name).toBe('Profit Wallet');
      expect(wallet.sourceType).toBe('PROFIT_FIRST');
      expect(wallet.profitFirstAccountId).toBe(pfAccount.id);
      expect(wallet.userId).toBe(user.id);
    });

    it('creates a BLANK (standalone) wallet without a PF account link', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01b@test.com', name: 'User B', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Blank Wallet',
        sourceType: 'BLANK',
        color: '#8b5cf6',
      });

      expect(wallet.name).toBe('Blank Wallet');
      expect(wallet.sourceType).toBe('BLANK');
      expect(wallet.profitFirstAccountId).toBeNull();
    });

    it('returns 409 when the same PF account is already linked to another wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01c@test.com', name: 'User C', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      await svc.create(user.id, {
        name: 'First Wallet',
        sourceType: 'PROFIT_FIRST',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
      });

      await expect(
        svc.create(user.id, {
          name: 'Second Wallet',
          sourceType: 'PROFIT_FIRST',
          profitFirstAccountId: pfAccount.id,
          color: '#8b5cf6',
        })
      ).rejects.toMatchObject({ status: 409, message: 'wallet_pf_account_already_linked' });
    });

    it('lists wallets with computed balanceCents, transactionCount, and mappingCount', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01d@test.com', name: 'User D', emailVerified: true });

      const svc = createWalletService(dbD1);
      await svc.create(user.id, { name: 'W1', sourceType: 'BLANK', color: '#10b981' });
      await svc.create(user.id, { name: 'W2', sourceType: 'BLANK', color: '#8b5cf6' });

      const wallets = await svc.list(user.id);
      expect(wallets).toHaveLength(2);
      expect(wallets[0]).toHaveProperty('balanceCents');
      expect(wallets[0]).toHaveProperty('transactionCount');
      expect(wallets[0]).toHaveProperty('mappingCount');
    });

    it('updates wallet name, color, and sortOrder', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01e@test.com', name: 'User E', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Old Name',
        sourceType: 'BLANK',
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

    it('deletes a wallet and cascades to mappings and transactions (D-16)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal01f@test.com', name: 'User F', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'To Delete',
        sourceType: 'BLANK',
        color: '#10b981',
      });

      const result = await svc.remove(wallet.id, user.id);
      expect(result.id).toBe(wallet.id);
      expect(result).toHaveProperty('transactionCount');
      expect(result).toHaveProperty('mappingCount');

      // Verify wallet is gone
      const wallets = await svc.list(user.id);
      expect(wallets).toHaveLength(0);
    });
  });

  // ─── WAL-02: income and expense category mappings ─────────────────────────

  describe('WAL-02: income and expense category mappings', () => {
    it('maps income categories to a wallet on create', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02a@test.com', name: 'User A', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Consulting');

      const svc = createWalletService(dbD1);
      await svc.create(user.id, {
        name: 'Mapped Wallet',
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
        color: '#10b981',
        incomeCategoryIds: [incCat.id],
      });

      await expect(
        svc.create(user.id, {
          name: 'Second Wallet',
          sourceType: 'BLANK',
          color: '#8b5cf6',
          incomeCategoryIds: [incCat.id],
        })
      ).rejects.toMatchObject({ status: 409, message: 'income_category_already_mapped' });
    });

    it('maps expense categories via expenseMode CATEGORIES to a wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02c@test.com', name: 'User C', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id, 'Rent');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Expense Wallet',
        sourceType: 'BLANK',
        color: '#10b981',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      const rows = db
        .select()
        .from(schema.walletExpenseCategoryMappings)
        .where(eq(schema.walletExpenseCategoryMappings.walletId, wallet.id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0].expenseCategoryId).toBe(expCat.id);

      // autoDeductAllExpenses should be false for CATEGORIES mode
      const walletRow = db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, wallet.id))
        .all()[0];
      expect(walletRow.autoDeductAllExpenses).toBe(false);
    });

    it('returns 409 when an expense category is already mapped to another wallet', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02d@test.com', name: 'User D', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id, 'Utilities');

      const svc = createWalletService(dbD1);
      await svc.create(user.id, {
        name: 'First Wallet',
        sourceType: 'BLANK',
        color: '#10b981',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      await expect(
        svc.create(user.id, {
          name: 'Second Wallet',
          sourceType: 'BLANK',
          color: '#8b5cf6',
          expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
        })
      ).rejects.toMatchObject({ status: 409, message: 'expense_category_already_mapped' });
    });

    it('expenseMode ALL sets autoDeductAllExpenses=true and clears category mappings', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02e@test.com', name: 'User E', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id, 'Food');

      const svc = createWalletService(dbD1);
      // Create with CATEGORIES first
      const wallet = await svc.create(user.id, {
        name: 'All Expenses Wallet',
        sourceType: 'BLANK',
        color: '#10b981',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      // Update to ALL — should clear specific mappings and set flag
      await svc.update(wallet.id, user.id, {
        expenseMode: { kind: 'ALL' },
      });

      const walletRow = db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, wallet.id))
        .all()[0];
      expect(walletRow.autoDeductAllExpenses).toBe(true);

      const expMappings = db
        .select()
        .from(schema.walletExpenseCategoryMappings)
        .where(eq(schema.walletExpenseCategoryMappings.walletId, wallet.id))
        .all();
      expect(expMappings).toHaveLength(0);
    });

    it('expenseMode NONE sets autoDeductAllExpenses=false and clears category mappings', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02f@test.com', name: 'User F', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id, 'Transport');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Clear Wallet',
        sourceType: 'BLANK',
        color: '#10b981',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      await svc.update(wallet.id, user.id, {
        expenseMode: { kind: 'NONE' },
      });

      const walletRow = db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.id, wallet.id))
        .all()[0];
      expect(walletRow.autoDeductAllExpenses).toBe(false);

      const expMappings = db
        .select()
        .from(schema.walletExpenseCategoryMappings)
        .where(eq(schema.walletExpenseCategoryMappings.walletId, wallet.id))
        .all();
      expect(expMappings).toHaveLength(0);
    });

    it('replaces existing income category mappings atomically on update', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02g@test.com', name: 'User G', emailVerified: true });
      const cat1 = seedIncomeCategory(db, user.id, 'Cat1');
      const cat2 = seedIncomeCategory(db, user.id, 'Cat2');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Replace Wallet',
        sourceType: 'BLANK',
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

    it('setting expenseMode ALL when another wallet already has it returns 409 auto_deduct_all_already_set', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02h@test.com', name: 'User H', emailVerified: true });

      const svc = createWalletService(dbD1);
      // First wallet gets ALL
      await svc.create(user.id, {
        name: 'Auto Deduct All',
        sourceType: 'BLANK',
        color: '#10b981',
        expenseMode: { kind: 'ALL' },
      });

      // Second wallet tries to get ALL too — should be rejected
      await expect(
        svc.create(user.id, {
          name: 'Second Wallet',
          sourceType: 'BLANK',
          color: '#8b5cf6',
          expenseMode: { kind: 'ALL' },
        })
      ).rejects.toMatchObject({ status: 409, message: 'auto_deduct_all_already_set' });
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
          sourceType: 'BLANK',
          color: '#10b981',
          incomeCategoryIds: [cat.id],
        })
      ).rejects.toMatchObject({ status: 403 });
    });

    it('rejects expense category not belonging to the authenticated user (T-04-07)', async () => {
      const { dbD1, db } = createTestDb();
      const user1 = seedUser(db, {
        email: 'wal02j-u1@test.com',
        name: 'User 1',
        emailVerified: true,
      });
      const user2 = seedUser(db, {
        email: 'wal02j-u2@test.com',
        name: 'User 2',
        emailVerified: true,
      });
      const cat = seedExpenseCategory(db, user2.id, 'Other Expense');

      const svc = createWalletService(dbD1);
      await expect(
        svc.create(user1.id, {
          name: 'Bad Wallet',
          sourceType: 'BLANK',
          color: '#10b981',
          expenseMode: { kind: 'CATEGORIES', ids: [cat.id] },
        })
      ).rejects.toMatchObject({ status: 403 });
    });

    it('PROFIT_FIRST wallet does not apply income mappings (D-08)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal02k@test.com', name: 'User K', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);
      const incCat = seedIncomeCategory(db, user.id, 'Salary');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        sourceType: 'PROFIT_FIRST',
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
    it('balance formula: pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03a@test.com', name: 'User A', emailVerified: true });

      // PF account with 10% (1000 bp)
      const pfAccount = seedPfAccount(db, user.id, { targetPercentage: 1000 });
      const incCat = seedIncomeCategory(db, user.id);
      const expCat = seedExpenseCategory(db, user.id);

      // Seed income: 10000 cents received
      seedIncome(db, user.id, incCat.id, 10000, 'RECEIVED');
      // Seed expense mapped to category: 500 cents
      seedExpense(db, user.id, expCat.id, 500);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        sourceType: 'PROFIT_FIRST',
        profitFirstAccountId: pfAccount.id,
        color: '#10b981',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;

      // pfAllocation = Math.round(10000 * 1000 / 10000) = 1000
      // mappedExpenses = 500 (non-deleted)
      // balance = 1000 + 0 - 500 + 0 - 0 = 500
      expect(listed.balanceCents).toBe(500);
    });

    it('allows negative balance (no clamp — D-13)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal03b@test.com', name: 'User B', emailVerified: true });

      const expCat = seedExpenseCategory(db, user.id);
      seedExpense(db, user.id, expCat.id, 5000);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Negative',
        sourceType: 'BLANK',
        color: '#f43f5e',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      const wallets = await svc.list(user.id);
      const listed = wallets.find((w) => w.id === wallet.id)!;

      // 0 - 5000 = -5000 (not clamped)
      expect(listed.balanceCents).toBe(-5000);
      expect(listed.balanceCents).toBeLessThan(0);
    });

    it('pfAllocation is basis-point ratio of total RECEIVED income for PROFIT_FIRST wallet', async () => {
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
        sourceType: 'PROFIT_FIRST',
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
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
        color: '#10b981',
        sortOrder: 10,
      });
      const w1 = await svc.create(user.id, {
        name: 'W1',
        sourceType: 'BLANK',
        color: '#8b5cf6',
        sortOrder: 0,
      });
      const w2 = await svc.create(user.id, {
        name: 'W2',
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
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
    it('blocks manual DEPOSIT on a PROFIT_FIRST wallet (manual_deposit_blocked_pf_wallet)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04a@test.com', name: 'User A', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Wallet',
        sourceType: 'PROFIT_FIRST',
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
        sourceType: 'BLANK',
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

    it('blocks manual WITHDRAWAL on a wallet with mapped expense categories (manual_withdrawal_blocked_expense_mapped)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04c@test.com', name: 'User C', emailVerified: true });
      const expCat = seedExpenseCategory(db, user.id, 'Rent');

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Expense Wallet',
        sourceType: 'BLANK',
        color: '#f59e0b',
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      await expect(
        svc.createTransaction(wallet.id, user.id, {
          type: 'WITHDRAWAL',
          amount: 300,
          transactionDate: '2026-01-01',
        })
      ).rejects.toMatchObject({ status: 400, message: 'manual_withdrawal_blocked_expense_mapped' });
    });

    it('blocks manual WITHDRAWAL on a wallet with autoDeductAllExpenses=true (manual_withdrawal_blocked_expense_mapped)', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04d@test.com', name: 'User D', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Auto All Wallet',
        sourceType: 'BLANK',
        color: '#f43f5e',
        expenseMode: { kind: 'ALL' },
      });

      await expect(
        svc.createTransaction(wallet.id, user.id, {
          type: 'WITHDRAWAL',
          amount: 200,
          transactionDate: '2026-01-01',
        })
      ).rejects.toMatchObject({ status: 400, message: 'manual_withdrawal_blocked_expense_mapped' });
    });

    it('allows manual WITHDRAWAL on a PROFIT_FIRST wallet with no expense mappings', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04e@test.com', name: 'User E', emailVerified: true });
      const pfAccount = seedPfAccount(db, user.id);

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'PF Withdrawal Wallet',
        sourceType: 'PROFIT_FIRST',
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

    it('creates and updates manual transactions on eligible wallets', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal04f@test.com', name: 'User F', emailVerified: true });

      const svc = createWalletService(dbD1);
      const wallet = await svc.create(user.id, {
        name: 'Blank Wallet',
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
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

    it('paginated history merges 3 sources (manual, income_auto, expense_auto) sorted DESC by transactionDate then id', async () => {
      const { dbD1, db } = createTestDb();
      const user = seedUser(db, { email: 'wal05e@test.com', name: 'User E', emailVerified: true });
      const incCat = seedIncomeCategory(db, user.id, 'Salary');
      const expCat = seedExpenseCategory(db, user.id, 'Rent');

      // Seed income and expense records
      const income = seedIncome(db, user.id, incCat.id, 5000, 'RECEIVED');
      const expense = seedExpense(db, user.id, expCat.id, 2000);

      const svc = createWalletService(dbD1);
      // BLANK wallet with income + expense mappings to auto-include them in history
      const wallet = await svc.create(user.id, {
        name: 'Full Wallet',
        sourceType: 'BLANK',
        color: '#14b8a6',
        incomeCategoryIds: [incCat.id],
        expenseMode: { kind: 'CATEGORIES', ids: [expCat.id] },
      });

      // Seed a manual transaction directly (income mapping blocks createTransaction DEPOSIT — correct behaviour)
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

      // Verify pagination shape
      expect(detail.pagination).toHaveProperty('page');
      expect(detail.pagination).toHaveProperty('size');
      expect(detail.pagination).toHaveProperty('total');
      expect(detail.pagination).toHaveProperty('totalPages');

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
        sourceType: 'BLANK',
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
        sourceType: 'BLANK',
        color: '#6366f1',
        incomeCategoryIds: [incCat.id],
      });

      // Insert 30 RECEIVED incomes with distinct ascending dates so ordering is observable
      const insertedIds: number[] = [];
      for (let i = 1; i <= 30; i++) {
        const month = String(i).padStart(2, '0');
        // Use 2026-01-01 through 2026-01-30 (i ≤ 30 — pad day)
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

    it('autoDeductAllExpenses: single inArray query produces no duplicate rows and total equals true count', async () => {
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
        name: 'Auto Expense Wallet',
        sourceType: 'BLANK',
        color: '#f97316',
        expenseMode: { kind: 'ALL' },
      });

      // 5 expenses in cat1, 5 in cat2 = 10 total
      for (let i = 1; i <= 5; i++) {
        const day = String(i).padStart(2, '0');
        db.insert(schema.expenses)
          .values({
            userId: user.id,
            categoryId: cat1.id,
            categoryName: 'Office',
            amount: i * 50,
            expenseDate: `2026-02-${day}`,
            deletedAt: null,
          })
          .run();
        db.insert(schema.expenses)
          .values({
            userId: user.id,
            categoryId: cat2.id,
            categoryName: 'Travel',
            amount: i * 75,
            expenseDate: `2026-02-${String(i + 10).padStart(2, '0')}`,
            deletedAt: null,
          })
          .run();
      }

      const detail = await svc.getById(wallet.id, user.id, { page: 0, size: 20 });

      // All 10 expenses are returned exactly once (no duplicates from per-category loop)
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
});
