import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { register, upsertGoogleUser } from '@/services/auth-service';
import { createProfitMunaService } from '@/services/profit-muna-service';
import { createTestDb, mockEnv, seedUser } from './helpers/db';

// Minimal Resend mock so auth-service email calls don't throw
import { vi } from 'vitest';

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ─── PM-01: Profit Muna account seeding ────────────────────────────────────

describe('PM-01: seedProfitMunaAccounts', () => {
  it('seeds default accounts on register', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);

    await register(env.DB, env.APP_BASE_URL, {
      email: 'register@pf.test',
      name: 'Register User',
      password: 'password123',
    });

    const users = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'register@pf.test'))
      .all();
    expect(users).toHaveLength(1);

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, users[0].id))
      .all();

    expect(accounts).toHaveLength(4);

    const byName = Object.fromEntries(accounts.map((a) => [a.name, a]));

    expect(byName['Profit']).toMatchObject({
      targetPercentage: 500,
      color: '#10b981',
      sortOrder: 0,
      accountType: 'PROFIT',
    });
    expect(byName['Owner Pay']).toMatchObject({
      targetPercentage: 5000,
      color: '#8b5cf6',
      sortOrder: 1,
      accountType: 'OWNERS_PAY',
    });
    expect(byName['Tax']).toMatchObject({
      targetPercentage: 1500,
      color: '#f59e0b',
      sortOrder: 2,
      accountType: 'TAX',
    });
    expect(byName['Operating Expenses']).toMatchObject({
      targetPercentage: 3000,
      color: '#f43f5e',
      sortOrder: 3,
      accountType: 'OPEX',
    });
  });

  it('seeds on Google OAuth first login', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);

    const userId = await upsertGoogleUser(env.DB, {
      sub: 'google-new-sub-123',
      email: 'googlenew@pf.test',
      name: 'Google New User',
    });

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, userId))
      .all();

    expect(accounts).toHaveLength(4);
    const names = accounts.map((a) => a.name).sort();
    expect(names).toEqual(['Operating Expenses', 'Owner Pay', 'Profit', 'Tax']);
  });

  it('does not duplicate accounts for returning Google user', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);

    // First login — new user, seeds 4 accounts
    const userId = await upsertGoogleUser(env.DB, {
      sub: 'google-returning-sub-456',
      email: 'googlereturning@pf.test',
      name: 'Google Returning User',
    });

    // Second login — returning user via googleId (branch 1), no seeding
    const userId2 = await upsertGoogleUser(env.DB, {
      sub: 'google-returning-sub-456',
      email: 'googlereturning@pf.test',
      name: 'Google Returning User',
    });

    expect(userId2).toBe(userId);

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, userId))
      .all();

    // Still exactly 4 — no duplicates
    expect(accounts).toHaveLength(4);
  });
});

// ─── PM-02: Profit Muna CRUD ────────────────────────────────────────────────

describe('PM-02: profit muna account CRUD', () => {
  it('rejects account creation that exceeds 100%', async () => {
    // Default accounts total 500+5000+1500+3000 = 10000 bp — adding any new one fails
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'crud@pf.test', name: 'CRUD User', emailVerified: true });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    // Seed the 4 defaults (500+5000+1500+3000 = 10000 bp)
    const { seedProfitMunaAccounts } = await import('@/services/profit-muna-service');
    await seedProfitMunaAccounts(drizzleDb, user.id);

    // Any addition now exceeds 10000
    await expect(
      svc.createAccount(user.id, {
        name: 'My Custom',
        targetPercentage: 100,
        color: '#3b82f6',
      })
    ).rejects.toThrow('Adding this account would exceed 100%');
  });

  it('cannot delete default account', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'del@pf.test', name: 'Del User', emailVerified: true });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    const { seedProfitMunaAccounts } = await import('@/services/profit-muna-service');
    await seedProfitMunaAccounts(drizzleDb, user.id);

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();

    const profitAccount = accounts.find((a) => a.accountType === 'PROFIT');
    expect(profitAccount).toBeDefined();

    await expect(svc.deleteAccount(profitAccount!.id, user.id)).rejects.toThrow(
      'Default accounts cannot be deleted.'
    );
  });

  it('deletes a custom account successfully', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'delcustom@pf.test',
      name: 'Del Custom User',
      emailVerified: true,
    });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    // Insert a CUSTOM account directly (defaults total 10000, so reduce one first)
    db.insert(schema.profitMunaAccounts)
      .values({
        name: 'Savings',
        targetPercentage: 0,
        color: '#3b82f6',
        sortOrder: 0,
        accountType: 'CUSTOM',
        userId: user.id,
      })
      .run();

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();

    const customAccount = accounts.find((a) => a.accountType === 'CUSTOM');
    expect(customAccount).toBeDefined();

    await svc.deleteAccount(customAccount!.id, user.id);

    const remaining = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();

    expect(remaining.find((a) => a.id === customAccount!.id)).toBeUndefined();
  });

  it('returns 404 for account not owned by caller', async () => {
    const { d1, db } = createTestDb();
    const user1 = seedUser(db, { email: 'u1@pf.test', name: 'User 1', emailVerified: true });
    const user2 = seedUser(db, { email: 'u2@pf.test', name: 'User 2', emailVerified: true });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    // Create a CUSTOM account for user1
    db.insert(schema.profitMunaAccounts)
      .values({
        name: 'User1 Account',
        targetPercentage: 0,
        color: '#3b82f6',
        sortOrder: 0,
        accountType: 'CUSTOM',
        userId: user1.id,
      })
      .run();

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user1.id))
      .all();

    // user2 trying to delete user1's account — should get 404
    await expect(svc.deleteAccount(accounts[0].id, user2.id)).rejects.toThrow();
  });
});

// ─── PM-03: Percentage update (sum-to-100% validation) ───────────────────────

describe('PM-03: percentage update (sum-to-100% validation)', () => {
  it('rejects percentages not summing to 10000', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'pct@pf.test', name: 'Pct User', emailVerified: true });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    const { seedProfitMunaAccounts } = await import('@/services/profit-muna-service');
    await seedProfitMunaAccounts(drizzleDb, user.id);

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();

    // Submit percentages totaling 9700 bp (not 10000): Profit 200 + OwnerPay 5000 + Tax 1500 + OPEX 3000 = 9700
    await expect(
      svc.updatePercentages(user.id, {
        accounts: accounts.map((a) => ({
          id: a.id,
          targetPercentage: a.accountType === 'PROFIT' ? 200 : a.targetPercentage,
        })),
      })
    ).rejects.toThrow('Percentages must total 100%. Current total: 97%.');
  });

  it('accepts valid percentage distribution', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'pctok@pf.test', name: 'Pct OK User', emailVerified: true });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    const { seedProfitMunaAccounts } = await import('@/services/profit-muna-service');
    await seedProfitMunaAccounts(drizzleDb, user.id);

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();

    // Redistribute: 1000+4500+1500+3000 = 10000 bp
    const result = await svc.updatePercentages(user.id, {
      accounts: accounts.map((a) => {
        if (a.accountType === 'PROFIT') return { id: a.id, targetPercentage: 1000 };
        if (a.accountType === 'OWNERS_PAY') return { id: a.id, targetPercentage: 4500 };
        return { id: a.id, targetPercentage: a.targetPercentage };
      }),
    });

    expect(result).toBeDefined();
    const profitAccount = result.find((a) => a.accountType === 'PROFIT');
    expect(profitAccount?.targetPercentage).toBe(1000);
  });

  it('rejects a partial-set submission (single account) with 400', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'partial@pf.test',
      name: 'Partial User',
      emailVerified: true,
    });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    const { seedProfitMunaAccounts } = await import('@/services/profit-muna-service');
    await seedProfitMunaAccounts(drizzleDb, user.id);

    const accounts = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();

    const profitAccount = accounts.find((a) => a.accountType === 'PROFIT');
    const ownersPayAccount = accounts.find((a) => a.accountType === 'OWNERS_PAY');
    if (!profitAccount || !ownersPayAccount) throw new Error('Seeded accounts not found');

    // Partial-set submission: only one account with 10000 bp — passes old sum check but must fail coverage check
    await expect(
      svc.updatePercentages(user.id, {
        accounts: [{ id: profitAccount.id, targetPercentage: 10000 }],
      })
    ).rejects.toThrow('Submit all accounts exactly once.');

    // Assert no partial write occurred — OWNERS_PAY must still have its seeded value (5000 bp)
    const afterAttempt = db
      .select()
      .from(schema.profitMunaAccounts)
      .where(eq(schema.profitMunaAccounts.userId, user.id))
      .all();
    const ownersPayAfter = afterAttempt.find((a) => a.accountType === 'OWNERS_PAY');
    expect(ownersPayAfter?.targetPercentage).toBe(5000);
  });
});

// ─── PM-04: Allocation summary ───────────────────────────────────────────────

describe('PM-04: allocation summary', () => {
  it('computes balance with integer math', async () => {
    // 100000 cents income * 500 bp / 10000 = Math.round(5000) = 5000 cents
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'summary@pf.test',
      name: 'Summary User',
      emailVerified: true,
    });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    // Seed profit account at 500 bp (5%)
    db.insert(schema.profitMunaAccounts)
      .values({
        name: 'Profit',
        targetPercentage: 500,
        color: '#10b981',
        sortOrder: 0,
        accountType: 'PROFIT',
        userId: user.id,
      })
      .run();

    // Seed an income category
    const [cat] = db
      .insert(schema.incomeCategories)
      .values({ name: 'Sales', userId: user.id, system: false })
      .returning()
      .all();

    // Insert RECEIVED + profitMunaAllocated income: 100000 cents
    db.insert(schema.incomes)
      .values({
        categoryId: cat.id,
        categoryName: 'Sales',
        amount: 100000,
        incomeDate: '2026-01-15',
        moneyStatus: 'RECEIVED',
        profitMunaAllocated: true,
        userId: user.id,
      })
      .run();

    const summary = await svc.getSummary(user.id);

    expect(summary.totalIncome).toBe(100000);
    const profitAcc = summary.accounts.find((a) => a.name === 'Profit');
    expect(profitAcc?.computedBalance).toBe(5000);
    // targetPercentage is returned as percent (5), not basis points (500) — Pitfall 3
    expect(profitAcc?.targetPercentage).toBe(5);
  });

  it('excludes PENDING income from balance', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'pending@pf.test',
      name: 'Pending User',
      emailVerified: true,
    });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    db.insert(schema.profitMunaAccounts)
      .values({
        name: 'Profit',
        targetPercentage: 500,
        color: '#10b981',
        sortOrder: 0,
        accountType: 'PROFIT',
        userId: user.id,
      })
      .run();

    const [cat] = db
      .insert(schema.incomeCategories)
      .values({ name: 'Sales', userId: user.id, system: false })
      .returning()
      .all();

    // PENDING income — should NOT count toward the summary
    db.insert(schema.incomes)
      .values({
        categoryId: cat.id,
        categoryName: 'Sales',
        amount: 200000,
        incomeDate: '2026-01-15',
        moneyStatus: 'PENDING',
        profitMunaAllocated: true,
        userId: user.id,
      })
      .run();

    // RECEIVED but profitMunaAllocated=false — should NOT count
    db.insert(schema.incomes)
      .values({
        categoryId: cat.id,
        categoryName: 'Sales',
        amount: 50000,
        incomeDate: '2026-01-15',
        moneyStatus: 'RECEIVED',
        profitMunaAllocated: false,
        userId: user.id,
      })
      .run();

    const summary = await svc.getSummary(user.id);

    expect(summary.totalIncome).toBe(0);
    const profitAcc = summary.accounts.find((a) => a.name === 'Profit');
    expect(profitAcc?.computedBalance).toBe(0);
  });

  it('applies date range filter', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'daterange@pf.test',
      name: 'Date Range User',
      emailVerified: true,
    });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    db.insert(schema.profitMunaAccounts)
      .values({
        name: 'Profit',
        targetPercentage: 500,
        color: '#10b981',
        sortOrder: 0,
        accountType: 'PROFIT',
        userId: user.id,
      })
      .run();

    const [cat] = db
      .insert(schema.incomeCategories)
      .values({ name: 'Sales', userId: user.id, system: false })
      .returning()
      .all();

    // January income: 100000 cents
    db.insert(schema.incomes)
      .values({
        categoryId: cat.id,
        categoryName: 'Sales',
        amount: 100000,
        incomeDate: '2026-01-15',
        moneyStatus: 'RECEIVED',
        profitMunaAllocated: true,
        userId: user.id,
      })
      .run();

    // February income: 200000 cents
    db.insert(schema.incomes)
      .values({
        categoryId: cat.id,
        categoryName: 'Sales',
        amount: 200000,
        incomeDate: '2026-02-15',
        moneyStatus: 'RECEIVED',
        profitMunaAllocated: true,
        userId: user.id,
      })
      .run();

    // Filter to January only
    const summary = await svc.getSummary(user.id, {
      from: '2026-01-01',
      to: '2026-01-31',
    });

    // Only the January income (100000) should be included
    expect(summary.totalIncome).toBe(100000);
    const profitAcc = summary.accounts.find((a) => a.name === 'Profit');
    // Math.round((100000 * 500) / 10000) = 5000
    expect(profitAcc?.computedBalance).toBe(5000);
  });

  it('returns distinct income categories present in user income', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'categories@pf.test',
      name: 'Categories User',
      emailVerified: true,
    });
    const { createDb } = await import('@app/db');
    const drizzleDb = createDb(d1);
    const svc = createProfitMunaService(drizzleDb);

    // Seed a PF account so getSummary has accounts to return
    db.insert(schema.profitMunaAccounts)
      .values({
        name: 'Profit',
        targetPercentage: 500,
        color: '#10b981',
        sortOrder: 0,
        accountType: 'PROFIT',
        userId: user.id,
      })
      .run();

    // Seed two distinct income categories
    const [catSales] = db
      .insert(schema.incomeCategories)
      .values({ name: 'Sales', userId: user.id, system: false })
      .returning()
      .all();

    const [catConsulting] = db
      .insert(schema.incomeCategories)
      .values({ name: 'Consulting', userId: user.id, system: false })
      .returning()
      .all();

    // Two RECEIVED + profitMunaAllocated incomes under different categories
    db.insert(schema.incomes)
      .values({
        categoryId: catSales.id,
        categoryName: 'Sales',
        amount: 50000,
        incomeDate: '2026-01-15',
        moneyStatus: 'RECEIVED',
        profitMunaAllocated: true,
        userId: user.id,
      })
      .run();

    db.insert(schema.incomes)
      .values({
        categoryId: catConsulting.id,
        categoryName: 'Consulting',
        amount: 80000,
        incomeDate: '2026-02-10',
        moneyStatus: 'RECEIVED',
        profitMunaAllocated: true,
        userId: user.id,
      })
      .run();

    const summary = await svc.getSummary(user.id);

    // categories must include both distinct categories, ordered by name
    expect(summary.categories).toHaveLength(2);
    const names = summary.categories.map((c) => c.name);
    expect(names).toContain('Sales');
    expect(names).toContain('Consulting');
    // ids must be numbers matching the seeded category rows
    const salesCat = summary.categories.find((c) => c.name === 'Sales');
    expect(salesCat?.id).toBe(catSales.id);
  });
});
