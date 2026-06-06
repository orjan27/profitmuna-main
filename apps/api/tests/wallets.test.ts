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
    it.todo('maps income categories to a wallet on create');
    it.todo('returns 409 when an income category is already mapped to another wallet');
    it.todo('maps expense categories via expenseMode CATEGORIES to a wallet');
    it.todo('returns 409 when an expense category is already mapped to another wallet');
    it.todo('expenseMode ALL sets autoDeductAllExpenses=true and clears category mappings');
    it.todo('expenseMode NONE sets autoDeductAllExpenses=false and clears category mappings');
    it.todo('replaces existing income category mappings atomically on update');
    it.todo(
      'setting expenseMode ALL when another wallet already has it returns 409 auto_deduct_all_already_set'
    );
    it.todo('rejects income category not belonging to the authenticated user (T-04-07)');
    it.todo('rejects expense category not belonging to the authenticated user (T-04-07)');
    it.todo('PROFIT_FIRST wallet does not apply income mappings (D-08)');
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
    it.todo('blocks manual DEPOSIT on a PROFIT_FIRST wallet (manual_deposit_blocked_pf_wallet)');
    it.todo(
      'blocks manual DEPOSIT on a wallet with mapped income categories (manual_deposit_blocked_income_mapped)'
    );
    it.todo(
      'blocks manual WITHDRAWAL on a wallet with mapped expense categories (manual_withdrawal_blocked_expense_mapped)'
    );
    it.todo(
      'blocks manual WITHDRAWAL on a wallet with autoDeductAllExpenses=true (manual_withdrawal_blocked_expense_mapped)'
    );
    it.todo('allows manual WITHDRAWAL on a PROFIT_FIRST wallet with no expense mappings');
    it.todo('creates and updates manual transactions on eligible wallets');
  });

  // ─── WAL-05: transaction soft-delete and restore ─────────────────────────

  describe('WAL-05: transaction soft-delete and restore', () => {
    it.todo('soft-delete sets deletedAt to ISO timestamp (null before delete)');
    it.todo('restore clears deletedAt back to null');
    it.todo('soft-deleted transactions appear in paginated history (D-09)');
    it.todo('balance computation excludes soft-deleted transactions');
    it.todo(
      'paginated history merges 3 sources (manual, income_auto, expense_auto) sorted DESC by transactionDate then id'
    );
  });
});
