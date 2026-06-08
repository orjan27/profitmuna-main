import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { createTestDb, mockEnv, seedUser } from './helpers/db';
import { createRecurringIncomeService } from '@/services/recurring-income-service';
import { createRecurringExpenseService } from '@/services/recurring-expense-service';
import { createRecurringIncomeSchema } from '@/schemas/recurring';
import { runCron } from '@/services/cron-service';

// Mock Resend so reminder email calls don't throw inside runCron
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ─── Seeding helpers (raw inserts — bypass the API) ──────────────────────────

type TestDb = ReturnType<typeof createTestDb>['db'];

function seedIncomeCategory(db: TestDb, userId: number, name: string) {
  const [row] = db.insert(schema.incomeCategories).values({ name, userId }).returning().all();
  return row!;
}

function seedExpenseCategory(db: TestDb, userId: number, name: string) {
  const [row] = db.insert(schema.expenseCategories).values({ name, userId }).returning().all();
  return row!;
}

function seedWallet(db: TestDb, userId: number, name: string) {
  const [row] = db
    .insert(schema.wallets)
    .values({ userId, name, color: '#888888' })
    .returning()
    .all();
  return row!;
}

function seedRecurringIncome(
  db: TestDb,
  input: Partial<typeof schema.recurringIncomes.$inferInsert> & {
    userId: number;
    categoryId: number;
    categoryName: string;
    frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  }
) {
  const [row] = db.insert(schema.recurringIncomes).values(input).returning().all();
  return row!;
}

function seedRecurringExpense(
  db: TestDb,
  input: Partial<typeof schema.recurringExpenses.$inferInsert> & {
    userId: number;
    categoryId: number;
    categoryName: string;
    amount: number;
    walletId: number;
    frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  }
) {
  const [row] = db.insert(schema.recurringExpenses).values(input).returning().all();
  return row!;
}

// 01:00 UTC = 09:00 Manila — all dates below are Manila days
const JUNE_15 = new Date('2026-06-15T01:00:00.000Z'); // Monday the 15th
const JUNE_30 = new Date('2026-06-30T01:00:00.000Z'); // Tuesday the 30th
const FEB_28 = new Date('2026-02-28T01:00:00.000Z'); // last day of Feb 2026

// ─── Cron generation: recurring incomes ───────────────────────────────────────

describe('runCron — recurring income generation', () => {
  it('generates a PENDING income with expectedReleaseDate = today on a MONTHLY due day', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri1@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    const template = seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
    });

    await runCron(env, JUNE_15);

    const incomes = db.select().from(schema.incomes).all();
    expect(incomes).toHaveLength(1);
    expect(incomes[0]).toMatchObject({
      categoryId: cat.id,
      categoryName: 'Salary',
      amount: 500000,
      incomeDate: '2026-06-15',
      moneyStatus: 'PENDING',
      expectedReleaseDate: '2026-06-15',
      userId: user.id,
    });

    // Dedup guard stamped
    const [updated] = db
      .select()
      .from(schema.recurringIncomes)
      .where(eq(schema.recurringIncomes.id, template.id))
      .all();
    expect(updated!.lastGeneratedDate).toBe('2026-06-15');
  });

  it('generates on a WEEKLY due day matching the Manila day of week', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri2@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Tutoring');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 100000,
      frequency: 'WEEKLY',
      dayOfWeek: 1, // Monday — 2026-06-15 is a Monday in Manila
    });

    await runCron(env, JUNE_15);

    expect(db.select().from(schema.incomes).all()).toHaveLength(1);
  });

  it('generates on the second BIWEEKLY day', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri3@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 250000,
      frequency: 'BIWEEKLY',
      dayOfMonth: 15,
      dayOfMonth2: 30,
    });

    await runCron(env, JUNE_30);

    const incomes = db.select().from(schema.incomes).all();
    expect(incomes).toHaveLength(1);
    expect(incomes[0]!.incomeDate).toBe('2026-06-30');
  });

  it('clamps a day-30 schedule to the last day of February', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri4@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 300000,
      frequency: 'MONTHLY',
      dayOfMonth: 30, // Feb 2026 has 28 days — fires on the 28th
    });

    await runCron(env, FEB_28);

    const incomes = db.select().from(schema.incomes).all();
    expect(incomes).toHaveLength(1);
    expect(incomes[0]!.incomeDate).toBe('2026-02-28');
  });

  it('generates exactly one income when the cron runs twice on the same Manila day', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri5@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
    });

    await runCron(env, JUNE_15);
    await runCron(env, new Date('2026-06-15T02:00:00.000Z')); // next hourly run

    expect(db.select().from(schema.incomes).all()).toHaveLength(1);
  });

  it('skips templates whose lastGeneratedDate is already today (record-now seeding)', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri6@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
      lastGeneratedDate: '2026-06-15', // entry recorded today alongside template
    });

    await runCron(env, JUNE_15);

    expect(db.select().from(schema.incomes).all()).toHaveLength(0);
  });

  it('skips inactive (paused) templates', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri7@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
      active: false,
    });

    await runCron(env, JUNE_15);

    expect(db.select().from(schema.incomes).all()).toHaveLength(0);
  });

  it('generates amount 0 for a null-amount template (amount set on receive)', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri8@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Commission');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: null,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
    });

    await runCron(env, JUNE_15);

    const incomes = db.select().from(schema.incomes).all();
    expect(incomes).toHaveLength(1);
    expect(incomes[0]!.amount).toBe(0);
  });

  it('fires a PENDING_INCOME_DUE notification for the generated income in the SAME run', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'ri9@test.com', name: 'RI User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
    });

    await runCron(env, JUNE_15);

    // Generation ran BEFORE the pending-due step, so the bell fired same-run
    const notifications = db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.type, 'PENDING_INCOME_DUE'))
      .all();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.userId).toBe(user.id);
  });
});

// ─── Cron generation: recurring expenses ──────────────────────────────────────

describe('runCron — recurring expense generation', () => {
  it('auto-records the expense and creates a RECURRING_EXPENSE_RECORDED notification', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 're1@test.com', name: 'RE User' })!;
    const cat = seedExpenseCategory(db, user.id, 'Rent');
    const wallet = seedWallet(db, user.id, 'Checking');
    seedRecurringExpense(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 1500000,
      walletId: wallet.id,
      walletName: wallet.name,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
    });

    await runCron(env, JUNE_15);

    const expenses = db.select().from(schema.expenses).all();
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({
      categoryName: 'Rent',
      amount: 1500000,
      expenseDate: '2026-06-15',
      walletId: wallet.id,
      walletName: 'Checking',
      deletedAt: null,
      userId: user.id,
    });

    const notifications = db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.type, 'RECURRING_EXPENSE_RECORDED'))
      .all();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.message).toContain('₱15,000.00');
    expect(notifications[0]!.message).toContain('Rent');
    expect(notifications[0]!.link).toBe('/expenses');
  });

  it('skips generation without stamping when the wallet is soft-deleted', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 're2@test.com', name: 'RE User' })!;
    const cat = seedExpenseCategory(db, user.id, 'Rent');
    const wallet = seedWallet(db, user.id, 'Old Wallet');
    db.update(schema.wallets)
      .set({ deletedAt: '2026-06-01T00:00:00.000Z' })
      .where(eq(schema.wallets.id, wallet.id))
      .run();
    const template = seedRecurringExpense(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 1500000,
      walletId: wallet.id,
      walletName: wallet.name,
      frequency: 'MONTHLY',
      dayOfMonth: 15,
    });

    await runCron(env, JUNE_15);

    expect(db.select().from(schema.expenses).all()).toHaveLength(0);
    // Not stamped — generation resumes if the wallet is restored
    const [after] = db
      .select()
      .from(schema.recurringExpenses)
      .where(eq(schema.recurringExpenses.id, template.id))
      .all();
    expect(after!.lastGeneratedDate).toBeNull();
  });

  it('does not generate on a non-matching day', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 're3@test.com', name: 'RE User' })!;
    const cat = seedExpenseCategory(db, user.id, 'Rent');
    const wallet = seedWallet(db, user.id, 'Checking');
    seedRecurringExpense(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 1500000,
      walletId: wallet.id,
      walletName: wallet.name,
      frequency: 'MONTHLY',
      dayOfMonth: 10,
    });

    await runCron(env, JUNE_15);

    expect(db.select().from(schema.expenses).all()).toHaveLength(0);
  });
});

// ─── Template service CRUD ────────────────────────────────────────────────────

describe('recurring-income service — CRUD', () => {
  it('creates a template with categoryName denormalized and days normalized per frequency', async () => {
    const { db } = createTestDb();
    const user = seedUser(db, { email: 'crud1@test.com', name: 'Crud User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    const svc = createRecurringIncomeService(db);

    const created = await svc.create(user.id, {
      categoryId: cat.id,
      amount: 500000,
      frequency: 'WEEKLY',
      dayOfWeek: 5,
      // Stray day-of-month values must be nulled for WEEKLY
      dayOfMonth: 10,
      dayOfMonth2: 20,
    });

    expect(created.categoryName).toBe('Salary');
    expect(created.dayOfWeek).toBe(5);
    expect(created.dayOfMonth).toBeNull();
    expect(created.dayOfMonth2).toBeNull();
    expect(created.active).toBe(true);
  });

  it("throws 400 invalid_category for another user's category", async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: 'crud2a@test.com', name: 'A' })!;
    const userB = seedUser(db, { email: 'crud2b@test.com', name: 'B' })!;
    const catB = seedIncomeCategory(db, userB.id, 'Intruder');
    const svc = createRecurringIncomeService(db);

    await expect(
      svc.create(userA.id, {
        categoryId: catB.id,
        amount: 1000,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
      })
    ).rejects.toMatchObject({ status: 400, message: 'invalid_category' });
  });

  it('throws 404 on cross-user update and delete (IDOR)', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: 'crud3a@test.com', name: 'A' })!;
    const userB = seedUser(db, { email: 'crud3b@test.com', name: 'B' })!;
    const cat = seedIncomeCategory(db, userA.id, 'Salary');
    const template = seedRecurringIncome(db, {
      userId: userA.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 1000,
      frequency: 'MONTHLY',
      dayOfMonth: 1,
    });
    const svc = createRecurringIncomeService(db);

    await expect(
      svc.update(template.id, userB.id, { frequency: 'MONTHLY', dayOfMonth: 2 })
    ).rejects.toMatchObject({ status: 404 });
    await expect(svc.delete(template.id, userB.id)).rejects.toMatchObject({ status: 404 });
  });

  it('pauses and resumes via update active flag', async () => {
    const { db } = createTestDb();
    const user = seedUser(db, { email: 'crud4@test.com', name: 'Crud User' })!;
    const cat = seedIncomeCategory(db, user.id, 'Salary');
    const template = seedRecurringIncome(db, {
      userId: user.id,
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 1000,
      frequency: 'MONTHLY',
      dayOfMonth: 1,
    });
    const svc = createRecurringIncomeService(db);

    const paused = await svc.update(template.id, user.id, {
      active: false,
      frequency: 'MONTHLY',
      dayOfMonth: 1,
    });
    expect(paused.active).toBe(false);

    const resumed = await svc.update(template.id, user.id, {
      active: true,
      frequency: 'MONTHLY',
      dayOfMonth: 1,
    });
    expect(resumed.active).toBe(true);
  });
});

describe('recurring-expense service — CRUD', () => {
  it('throws 400 invalid_wallet for a soft-deleted wallet', async () => {
    const { db } = createTestDb();
    const user = seedUser(db, { email: 'crud5@test.com', name: 'Crud User' })!;
    const cat = seedExpenseCategory(db, user.id, 'Rent');
    const wallet = seedWallet(db, user.id, 'Gone');
    db.update(schema.wallets)
      .set({ deletedAt: '2026-06-01T00:00:00.000Z' })
      .where(eq(schema.wallets.id, wallet.id))
      .run();
    const svc = createRecurringExpenseService(db);

    await expect(
      svc.create(user.id, {
        categoryId: cat.id,
        amount: 1000,
        walletId: wallet.id,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
      })
    ).rejects.toMatchObject({ status: 400, message: 'invalid_wallet' });
  });
});

// ─── Schema validation ────────────────────────────────────────────────────────

describe('recurring schemas — cross-field refinement', () => {
  it('rejects BIWEEKLY with identical days', () => {
    const result = createRecurringIncomeSchema.safeParse({
      categoryId: 1,
      amount: 1000,
      frequency: 'BIWEEKLY',
      dayOfMonth: 15,
      dayOfMonth2: 15,
    });
    expect(result.success).toBe(false);
  });

  it('rejects WEEKLY without dayOfWeek and MONTHLY without dayOfMonth', () => {
    expect(
      createRecurringIncomeSchema.safeParse({ categoryId: 1, frequency: 'WEEKLY' }).success
    ).toBe(false);
    expect(
      createRecurringIncomeSchema.safeParse({ categoryId: 1, frequency: 'MONTHLY' }).success
    ).toBe(false);
  });

  it('accepts a valid BIWEEKLY 15/30 template with null amount', () => {
    const result = createRecurringIncomeSchema.safeParse({
      categoryId: 1,
      amount: null,
      frequency: 'BIWEEKLY',
      dayOfMonth: 15,
      dayOfMonth2: 30,
    });
    expect(result.success).toBe(true);
  });
});
