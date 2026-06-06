import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { register, upsertGoogleUser } from '@/services/auth-service';
import { createTestDb, mockEnv } from './helpers/db';

// Minimal Resend mock so auth-service email calls don't throw
import { vi } from 'vitest';

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// ─── PF-01: Profit First account seeding ────────────────────────────────────

describe('PF-01: seedProfitFirstAccounts', () => {
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
      .from(schema.profitFirstAccounts)
      .where(eq(schema.profitFirstAccounts.userId, users[0].id))
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
      .from(schema.profitFirstAccounts)
      .where(eq(schema.profitFirstAccounts.userId, userId))
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
      .from(schema.profitFirstAccounts)
      .where(eq(schema.profitFirstAccounts.userId, userId))
      .all();

    // Still exactly 4 — no duplicates
    expect(accounts).toHaveLength(4);
  });
});

// ─── PF-02/03/04 placeholders (filled by Plan 02) ───────────────────────────

describe('PF-02: profit first account CRUD', () => {
  it.todo('lists accounts for authenticated user');
  it.todo('creates a custom account');
  it.todo('updates account name and color');
  it.todo('deletes a custom account');
  it.todo('cannot delete a default account');
  it.todo('cannot delete an account linked to a wallet');
});

describe('PF-03: percentage update (sum-to-100% validation)', () => {
  it.todo('updates percentages when they sum to exactly 10000 bp');
  it.todo('rejects update when percentages do not sum to 10000 bp');
});

describe('PF-04: allocation summary', () => {
  it.todo('returns derived balances for all accounts');
  it.todo('filters by date range');
  it.todo('filters by category ids');
});
