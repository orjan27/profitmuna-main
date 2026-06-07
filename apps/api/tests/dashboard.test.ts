import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { createDashboardService } from '@/services/dashboard-service';
import { seedProfitFirstAccounts } from '@/services/profit-first-service';
import { createTestDb, seedUser } from './helpers/db';

// ─── Seeding helpers (raw inserts — bypass the API) ──────────────────────────

type TestDb = ReturnType<typeof createTestDb>['db'];

function seedIncomeCategory(db: TestDb, userId: number, name: string) {
  const [row] = db.insert(schema.incomeCategories).values({ name, userId }).returning().all();
  return row;
}

function seedExpenseCategory(db: TestDb, userId: number, name: string) {
  const [row] = db.insert(schema.expenseCategories).values({ name, userId }).returning().all();
  return row;
}

function seedIncome(
  db: TestDb,
  input: {
    userId: number;
    categoryId: number;
    categoryName: string;
    amount: number;
    incomeDate: string;
    moneyStatus?: 'RECEIVED' | 'PENDING';
    profitFirstAllocated?: boolean;
  }
) {
  const [row] = db
    .insert(schema.incomes)
    .values({
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      amount: input.amount,
      incomeDate: input.incomeDate,
      moneyStatus: input.moneyStatus ?? 'RECEIVED',
      profitFirstAllocated: input.profitFirstAllocated ?? true,
      userId: input.userId,
    })
    .returning()
    .all();
  return row;
}

function seedExpense(
  db: TestDb,
  input: {
    userId: number;
    categoryId: number;
    categoryName: string;
    amount: number;
    expenseDate: string;
    walletId?: number | null;
    deletedAt?: string | null;
  }
) {
  const [row] = db
    .insert(schema.expenses)
    .values({
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      amount: input.amount,
      expenseDate: input.expenseDate,
      walletId: input.walletId ?? null,
      walletName: null,
      deletedAt: input.deletedAt ?? null,
      userId: input.userId,
    })
    .returning()
    .all();
  return row;
}

function seedWallet(
  db: TestDb,
  input: {
    userId: number;
    name: string;
    profitFirstAccountId?: number | null;
  }
) {
  const [row] = db
    .insert(schema.wallets)
    .values({
      userId: input.userId,
      name: input.name,
      profitFirstAccountId: input.profitFirstAccountId ?? null,
      color: '#0ea5e9',
    })
    .returning()
    .all();
  return row;
}

function seedWalletTx(
  db: TestDb,
  input: {
    userId: number;
    walletId: number;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    transactionDate: string;
    deletedAt?: string | null;
  }
) {
  const [row] = db
    .insert(schema.walletTransactions)
    .values({
      walletId: input.walletId,
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      transactionDate: input.transactionDate,
      deletedAt: input.deletedAt ?? null,
    })
    .returning()
    .all();
  return row;
}

// ─── DASH-01: dashboard summary aggregates ───────────────────────────────────

describe('dashboard service — getSummary', () => {
  it('returns zeroed totals and an empty feed for a user with no data', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'empty@dash.test', name: 'Empty User' });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    expect(summary.totalIncomeReceivedCents).toBe(0);
    expect(summary.totalIncomePendingCents).toBe(0);
    expect(summary.totalExpensesCents).toBe(0);
    expect(summary.netIncomeCents).toBe(0);
    expect(summary.totalWalletBalanceCents).toBe(0);
    expect(summary.recentTransactions).toEqual([]);
    expect(summary.feedPagination.hasMore).toBe(false);
  });

  it('sums RECEIVED and PENDING incomes separately', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'status@dash.test', name: 'Status User' });
    const cat = seedIncomeCategory(db, user.id, 'Salary');

    seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 10_000,
      incomeDate: '2026-06-01',
      moneyStatus: 'RECEIVED',
    });
    seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 5_000,
      incomeDate: '2026-06-02',
      moneyStatus: 'RECEIVED',
    });
    seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 3_000,
      incomeDate: '2026-06-03',
      moneyStatus: 'PENDING',
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    expect(summary.totalIncomeReceivedCents).toBe(15_000);
    expect(summary.totalIncomePendingCents).toBe(3_000);
  });

  it('excludes soft-deleted expenses from totalExpensesCents', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'softdel@dash.test', name: 'SoftDel User' });
    const cat = seedExpenseCategory(db, user.id, 'Food');

    seedExpense(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 2_000,
      expenseDate: '2026-06-05',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 9_999,
      expenseDate: '2026-06-06',
      deletedAt: '2026-06-07T00:00:00.000Z',
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    expect(summary.totalExpensesCents).toBe(2_000);
  });

  it('computes netIncomeCents as received income minus expenses', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'net@dash.test', name: 'Net User' });
    const incomeCat = seedIncomeCategory(db, user.id, 'Salary');
    const expenseCat = seedExpenseCategory(db, user.id, 'Rent');

    seedIncome(db, {
      userId: user.id,
      categoryId: incomeCat.id,
      categoryName: incomeCat.name,
      amount: 10_000,
      incomeDate: '2026-06-01',
      moneyStatus: 'RECEIVED',
    });
    seedIncome(db, {
      userId: user.id,
      categoryId: incomeCat.id,
      categoryName: incomeCat.name,
      amount: 4_000,
      incomeDate: '2026-06-02',
      moneyStatus: 'PENDING',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: expenseCat.id,
      categoryName: expenseCat.name,
      amount: 6_500,
      expenseDate: '2026-06-03',
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    // Pending income does NOT count toward net
    expect(summary.netIncomeCents).toBe(10_000 - 6_500);
    expect(summary.netIncomeCents).toBe(
      summary.totalIncomeReceivedCents - summary.totalExpensesCents
    );
  });

  it('restricts income (by incomeDate) and expense (by expenseDate) aggregates to the from/to range', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'range@dash.test', name: 'Range User' });
    const incomeCat = seedIncomeCategory(db, user.id, 'Salary');
    const expenseCat = seedExpenseCategory(db, user.id, 'Food');

    // In-range rows
    seedIncome(db, {
      userId: user.id,
      categoryId: incomeCat.id,
      categoryName: incomeCat.name,
      amount: 7_000,
      incomeDate: '2026-06-10',
      moneyStatus: 'RECEIVED',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: expenseCat.id,
      categoryName: expenseCat.name,
      amount: 1_500,
      expenseDate: '2026-06-12',
    });
    // Out-of-range rows
    seedIncome(db, {
      userId: user.id,
      categoryId: incomeCat.id,
      categoryName: incomeCat.name,
      amount: 50_000,
      incomeDate: '2026-05-01',
      moneyStatus: 'RECEIVED',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: expenseCat.id,
      categoryName: expenseCat.name,
      amount: 40_000,
      expenseDate: '2026-07-01',
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id, {
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(summary.totalIncomeReceivedCents).toBe(7_000);
    expect(summary.totalExpensesCents).toBe(1_500);
    expect(summary.netIncomeCents).toBe(7_000 - 1_500);
  });

  it('returns profitFirstAccounts with computedBalance from the PF summary', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'pf@dash.test', name: 'PF User' });
    await seedProfitFirstAccounts(dbD1, user.id);
    const cat = seedIncomeCategory(db, user.id, 'Salary');

    seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 100_000,
      incomeDate: '2026-06-10',
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    expect(summary.profitFirstAccounts).toHaveLength(4);
    const profit = summary.profitFirstAccounts.find((a) => a.accountType === 'PROFIT');
    // Profit defaults to 500 bp (5%) → 5% of 100,000 cents
    expect(profit?.computedBalance).toBe(5_000);
    const ownerPay = summary.profitFirstAccounts.find((a) => a.accountType === 'OWNERS_PAY');
    expect(ownerPay?.computedBalance).toBe(50_000);
  });

  it('computes a period-scoped totalWalletBalanceCents, not all-time', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'wallet@dash.test', name: 'Wallet User' });
    await seedProfitFirstAccounts(dbD1, user.id);
    const cat = seedIncomeCategory(db, user.id, 'Salary');

    const pfAccounts = db
      .select()
      .from(schema.profitFirstAccounts)
      .where(eq(schema.profitFirstAccounts.userId, user.id))
      .all();
    const profitAccount = pfAccounts.find((a) => a.accountType === 'PROFIT');
    expect(profitAccount).toBeDefined();

    // PF-linked wallet: allocation = 5% (500 bp) of received income
    seedWallet(db, {
      userId: user.id,
      name: 'Profit Vault',
      profitFirstAccountId: profitAccount!.id,
    });
    // Standalone wallet with manual transactions
    const blank = seedWallet(db, { userId: user.id, name: 'Cash' });

    seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 100_000,
      incomeDate: '2026-06-10',
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });
    seedWalletTx(db, {
      userId: user.id,
      walletId: blank.id,
      type: 'DEPOSIT',
      amount: 5_000,
      transactionDate: '2026-06-15',
    });
    seedWalletTx(db, {
      userId: user.id,
      walletId: blank.id,
      type: 'WITHDRAWAL',
      amount: 2_000,
      transactionDate: '2026-06-16',
    });

    const svc = createDashboardService(dbD1);

    // June range includes everything:
    // pfAllocation(5% of 100,000 = 5,000) + deposits(5,000) - withdrawals(2,000)
    const june = await svc.getSummary(user.id, { from: '2026-06-01', to: '2026-06-30' });
    expect(june.totalWalletBalanceCents).toBe(5_000 + 5_000 - 2_000);

    // July range excludes all of it — proves the balance is period-scoped, not all-time
    const july = await svc.getSummary(user.id, { from: '2026-07-01', to: '2026-07-31' });
    expect(july.totalWalletBalanceCents).toBe(0);
  });

  it('deducts wallet-assigned expenses from totalWalletBalanceCents by walletId, period-scoped', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'wexp@dash.test', name: 'Wallet Expense User' });
    const expCat = seedExpenseCategory(db, user.id, 'Rent');
    const wallet = seedWallet(db, { userId: user.id, name: 'Cash' });

    // Deposit 10,000 then assign a 4,000 expense to this wallet — both in June
    seedWalletTx(db, {
      userId: user.id,
      walletId: wallet.id,
      type: 'DEPOSIT',
      amount: 10_000,
      transactionDate: '2026-06-05',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: expCat.id,
      categoryName: expCat.name,
      amount: 4_000,
      expenseDate: '2026-06-10',
      walletId: wallet.id,
    });
    // A legacy NULL-wallet expense must NOT affect any wallet balance
    seedExpense(db, {
      userId: user.id,
      categoryId: expCat.id,
      categoryName: expCat.name,
      amount: 9_999,
      expenseDate: '2026-06-11',
      walletId: null,
    });

    const svc = createDashboardService(dbD1);

    // June: deposits(10,000) - walletExpense(4,000) = 6,000
    const june = await svc.getSummary(user.id, { from: '2026-06-01', to: '2026-06-30' });
    expect(june.totalWalletBalanceCents).toBe(6_000);

    // July: nothing in range
    const july = await svc.getSummary(user.id, { from: '2026-07-01', to: '2026-07-31' });
    expect(july.totalWalletBalanceCents).toBe(0);
  });

  it('merges income, expense, and wallet transactions into a date-DESC feed excluding soft-deleted rows', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'feed@dash.test', name: 'Feed User' });
    const incomeCat = seedIncomeCategory(db, user.id, 'Salary');
    const expenseCat = seedExpenseCategory(db, user.id, 'Food');
    const wallet = seedWallet(db, { userId: user.id, name: 'Cash' });

    seedIncome(db, {
      userId: user.id,
      categoryId: incomeCat.id,
      categoryName: incomeCat.name,
      amount: 10_000,
      incomeDate: '2026-06-10',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: expenseCat.id,
      categoryName: expenseCat.name,
      amount: 2_000,
      expenseDate: '2026-06-12',
    });
    seedExpense(db, {
      userId: user.id,
      categoryId: expenseCat.id,
      categoryName: expenseCat.name,
      amount: 9_999,
      expenseDate: '2026-06-13',
      deletedAt: '2026-06-14T00:00:00.000Z',
    });
    seedWalletTx(db, {
      userId: user.id,
      walletId: wallet.id,
      type: 'WITHDRAWAL',
      amount: 1_000,
      transactionDate: '2026-06-11',
    });
    seedWalletTx(db, {
      userId: user.id,
      walletId: wallet.id,
      type: 'DEPOSIT',
      amount: 3_000,
      transactionDate: '2026-06-14',
    });
    seedWalletTx(db, {
      userId: user.id,
      walletId: wallet.id,
      type: 'DEPOSIT',
      amount: 8_888,
      transactionDate: '2026-06-15',
      deletedAt: '2026-06-16T00:00:00.000Z',
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    // Soft-deleted expense (06-13) and soft-deleted wallet tx (06-15) excluded
    expect(summary.recentTransactions).toHaveLength(4);
    expect(summary.recentTransactions.map((t) => t.kind)).toEqual([
      'wallet_deposit', // 2026-06-14
      'expense', // 2026-06-12
      'wallet_withdrawal', // 2026-06-11
      'income', // 2026-06-10
    ]);
    expect(summary.recentTransactions.map((t) => t.date)).toEqual([
      '2026-06-14',
      '2026-06-12',
      '2026-06-11',
      '2026-06-10',
    ]);

    // Row navigation targets (D-05)
    const byKind = Object.fromEntries(summary.recentTransactions.map((t) => [t.kind, t]));
    expect(byKind['income'].href).toBe('/income');
    expect(byKind['expense'].href).toBe('/expenses');
    expect(byKind['wallet_deposit'].href).toBe(`/wallets/${wallet.id}`);
    expect(byKind['wallet_withdrawal'].href).toBe(`/wallets/${wallet.id}`);
  });

  it('tie-breaks same-date feed rows by id DESC', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'tiebreak@dash.test', name: 'TieBreak User' });
    const cat = seedIncomeCategory(db, user.id, 'Salary');

    const first = seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 1_000,
      incomeDate: '2026-06-10',
    });
    const second = seedIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 2_000,
      incomeDate: '2026-06-10',
    });

    const summary = await createDashboardService(dbD1).getSummary(user.id);

    expect(summary.recentTransactions.map((t) => t.id)).toEqual([second.id, first.id]);
  });

  it('paginates the feed with feedPage/feedSize and reports hasMore', async () => {
    const { db, dbD1 } = createTestDb();
    const user = seedUser(db, { email: 'page@dash.test', name: 'Page User' });
    const cat = seedIncomeCategory(db, user.id, 'Salary');

    // 5 incomes on distinct dates → 3 pages at feedSize=2
    for (let day = 1; day <= 5; day++) {
      seedIncome(db, {
        userId: user.id,
        categoryId: cat.id,
        categoryName: cat.name,
        amount: day * 1_000,
        incomeDate: `2026-06-0${day}`,
      });
    }

    const svc = createDashboardService(dbD1);

    const page0 = await svc.getSummary(user.id, undefined, 0, 2);
    expect(page0.recentTransactions).toHaveLength(2);
    expect(page0.recentTransactions.map((t) => t.date)).toEqual(['2026-06-05', '2026-06-04']);
    expect(page0.feedPagination).toEqual({ page: 0, size: 2, hasMore: true });

    const page1 = await svc.getSummary(user.id, undefined, 1, 2);
    expect(page1.recentTransactions.map((t) => t.date)).toEqual(['2026-06-03', '2026-06-02']);
    expect(page1.feedPagination.hasMore).toBe(true);

    const page2 = await svc.getSummary(user.id, undefined, 2, 2);
    expect(page2.recentTransactions.map((t) => t.date)).toEqual(['2026-06-01']);
    expect(page2.feedPagination.hasMore).toBe(false);
  });

  it("never leaks another user's data into totals or feed", async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: 'a@dash.test', name: 'User A' });
    const userB = seedUser(db, { email: 'b@dash.test', name: 'User B' });

    // User A's data
    const catA = seedIncomeCategory(db, userA.id, 'Salary');
    seedIncome(db, {
      userId: userA.id,
      categoryId: catA.id,
      categoryName: catA.name,
      amount: 10_000,
      incomeDate: '2026-06-10',
    });

    // User B's data — must never surface for A
    await seedProfitFirstAccounts(dbD1, userB.id);
    const incomeCatB = seedIncomeCategory(db, userB.id, 'Intruder Income');
    const expenseCatB = seedExpenseCategory(db, userB.id, 'Intruder Expense');
    seedIncome(db, {
      userId: userB.id,
      categoryId: incomeCatB.id,
      categoryName: incomeCatB.name,
      amount: 77_777,
      incomeDate: '2026-06-11',
    });
    seedExpense(db, {
      userId: userB.id,
      categoryId: expenseCatB.id,
      categoryName: expenseCatB.name,
      amount: 66_666,
      expenseDate: '2026-06-12',
    });
    const walletB = seedWallet(db, { userId: userB.id, name: 'B Cash' });
    seedWalletTx(db, {
      userId: userB.id,
      walletId: walletB.id,
      type: 'DEPOSIT',
      amount: 55_555,
      transactionDate: '2026-06-13',
    });

    const summaryA = await createDashboardService(dbD1).getSummary(userA.id);

    expect(summaryA.totalIncomeReceivedCents).toBe(10_000);
    expect(summaryA.totalExpensesCents).toBe(0);
    expect(summaryA.totalWalletBalanceCents).toBe(0);
    expect(summaryA.profitFirstAccounts).toHaveLength(0);
    expect(summaryA.recentTransactions).toHaveLength(1);
    expect(
      summaryA.recentTransactions.some(
        (t) => t.label.includes('Intruder') || t.amountCents > 10_000
      )
    ).toBe(false);
  });
});
