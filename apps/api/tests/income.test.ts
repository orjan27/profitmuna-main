import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { incomeCategories } from '@app/db/schema';
import { createTestDb, seedUser } from './helpers/db';
import { createIncomeService } from '../src/services/income-service';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const USER_A_EMAIL = 'user-a@test.com';
const USER_B_EMAIL = 'user-b@test.com';

// Mirror the service's default-receivedDate basis exactly: format(new Date())
// is system-local (runtime TZ is Asia/Manila), NOT UTC. Using toISOString()
// here drifted by a day during the UTC-evening / Manila-next-day window.
function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── INC-01: Create income ────────────────────────────────────────────────────

describe('income service — INC-01 create', () => {
  it('inserts a row with amount in cents, categoryName resolved from categoryId, status from input', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Consulting', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);

    const result = await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 150000, // already cents
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    expect(result.amount).toBe(150000);
    expect(result.categoryName).toBe('Consulting');
    expect(result.moneyStatus).toBe('PENDING');
    expect(result.profitFirstAllocated).toBe(true);
    expect(result.id).toBeGreaterThan(0);
  });

  it('throws 400 invalid_category if categoryId belongs to another user', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const [catB] = await db
      .insert(incomeCategories)
      .values({ name: 'Freelance', system: false, userId: userB.id })
      .returning();

    const svc = createIncomeService(db);

    await expect(
      svc.create(userA.id, {
        categoryId: catB!.id,
        amount: 100000,
        incomeDate: today(),
        moneyStatus: 'PENDING',
        profitFirstAllocated: true,
      })
    ).rejects.toMatchObject({ status: 400, message: 'invalid_category' });
  });
});

// ─── INC-02: List income ─────────────────────────────────────────────────────

describe('income service — INC-02 list', () => {
  it('returns paginated results ordered by incomeDate desc', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Sales', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 100000,
      incomeDate: '2026-01-10',
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 200000,
      incomeDate: '2026-01-15',
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    const result = await svc.list(userA.id, { page: 0, limit: 20 });
    expect(result.content).toHaveLength(2);
    expect(result.content[0]!.incomeDate).toBe('2026-01-15'); // desc order
    expect(result.page).toBe(0);
    expect(result.last).toBe(true);
  });

  it('filters by moneyStatus', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Salary', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 50000,
      incomeDate: today(),
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 75000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    const pending = await svc.list(userA.id, { page: 0, limit: 20, moneyStatus: 'PENDING' });
    expect(pending.content).toHaveLength(1);
    expect(pending.content[0]!.moneyStatus).toBe('PENDING');
  });

  it('filters by search (description or categoryName)', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Consulting', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 100000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      description: 'Client A project',
      profitFirstAllocated: true,
    });
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 200000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      description: 'Other work',
      profitFirstAllocated: true,
    });

    const result = await svc.list(userA.id, { page: 0, limit: 20, search: 'Client A' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.description).toBe('Client A project');
  });

  it('filters by date range', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Bonus', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 10000,
      incomeDate: '2026-01-01',
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 20000,
      incomeDate: '2026-03-15',
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });
    await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 30000,
      incomeDate: '2026-06-01',
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: true,
    });

    const result = await svc.list(userA.id, {
      page: 0,
      limit: 20,
      from: '2026-02-01',
      to: '2026-04-30',
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.amount).toBe(20000);
  });
});

// ─── INC-03: Update income ────────────────────────────────────────────────────

describe('income service — INC-03 update', () => {
  it('updates fields on the owned row', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Retainer', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 100000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    const updated = await svc.update(created.id, userA.id, {
      categoryId: cat!.id,
      amount: 200000,
      incomeDate: today(),
      moneyStatus: 'RECEIVED',
      profitFirstAllocated: false,
    });

    expect(updated.amount).toBe(200000);
    expect(updated.moneyStatus).toBe('RECEIVED');
    expect(updated.profitFirstAllocated).toBe(false);
  });

  it("throws 404 not_found when updating another user's income", async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const [catA] = await db
      .insert(incomeCategories)
      .values({ name: 'CategoryA', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: catA!.id,
      amount: 100000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    // userB tries to update userA's income — IDOR prevention
    await expect(
      svc.update(created.id, userB.id, {
        categoryId: catA!.id,
        amount: 999999,
        incomeDate: today(),
        moneyStatus: 'RECEIVED',
        profitFirstAllocated: true,
      })
    ).rejects.toMatchObject({ status: 404, message: 'not_found' });
  });
});

// ─── INC-04: Delete income ────────────────────────────────────────────────────

describe('income service — INC-04 delete', () => {
  it('hard-deletes the owned row', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Project', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 50000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    await svc.delete(created.id, userA.id);

    const result = await svc.list(userA.id, { page: 0, limit: 20 });
    expect(result.content).toHaveLength(0);
  });

  it("throws 404 not_found when deleting another user's income", async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const [catA] = await db
      .insert(incomeCategories)
      .values({ name: 'CatA', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: catA!.id,
      amount: 50000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    await expect(svc.delete(created.id, userB.id)).rejects.toMatchObject({
      status: 404,
      message: 'not_found',
    });
  });
});

// ─── INC-05: Receive income ───────────────────────────────────────────────────

describe('income service — INC-05 receive', () => {
  it('sets moneyStatus to RECEIVED and sets receivedDate, does NOT change profitFirstAllocated', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Invoice', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 80000,
      incomeDate: '2026-05-01',
      moneyStatus: 'PENDING',
      profitFirstAllocated: true, // should remain true after receive
    });

    const received = await svc.receive(created.id, userA.id, '2026-05-15');

    expect(received.moneyStatus).toBe('RECEIVED');
    expect(received.receivedDate).toBe('2026-05-15');
    // T-02-08: receive() must NOT modify profitFirstAllocated
    expect(received.profitFirstAllocated).toBe(true);
  });

  it('uses today as receivedDate when not provided', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Invoice2', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 50000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    const received = await svc.receive(created.id, userA.id);

    expect(received.moneyStatus).toBe('RECEIVED');
    expect(received.receivedDate).toBe(today());
  });

  it('throws 404 not_found for cross-user receive (IDOR)', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const [catA] = await db
      .insert(incomeCategories)
      .values({ name: 'CatA2', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: catA!.id,
      amount: 50000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    // userB cannot receive userA's income
    await expect(svc.receive(created.id, userB.id)).rejects.toMatchObject({
      status: 404,
      message: 'not_found',
    });
  });

  it('updates the amount when provided at receive time, leaving profitFirstAllocated untouched', async () => {
    const { db } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Estimate Cat', system: false, userId: userA.id })
      .returning();

    const svc = createIncomeService(db);
    const created = await svc.create(userA.id, {
      categoryId: cat!.id,
      amount: 100000, // estimated
      incomeDate: today(),
      moneyStatus: 'PENDING',
      profitFirstAllocated: true,
    });

    const received = await svc.receive(created.id, userA.id, today(), 123456);

    expect(received.moneyStatus).toBe('RECEIVED');
    expect(received.amount).toBe(123456);
    expect(received.profitFirstAllocated).toBe(true);
  });

  it('throws 422 amount_required when receiving a 0-amount income without an amount', async () => {
    const { db, sqlite } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const [cat] = await db
      .insert(incomeCategories)
      .values({ name: 'Recurring Cat', system: false, userId: userA.id })
      .returning();

    // Recurring "amount set on receive" income — amount 0 bypasses the create
    // schema (positive int) by design, so seed the row directly.
    sqlite
      .prepare(
        `INSERT INTO incomes (category_id, category_name, amount, income_date, money_status, profit_first_allocated, user_id)
         VALUES (?, ?, 0, ?, 'PENDING', 1, ?)`
      )
      .run(cat!.id, cat!.name, today(), userA.id);
    const row = sqlite.prepare('SELECT id FROM incomes WHERE amount = 0').get() as { id: number };

    const svc = createIncomeService(db);

    await expect(svc.receive(row.id, userA.id, today())).rejects.toMatchObject({
      status: 422,
      message: 'amount_required',
    });

    // Providing the amount succeeds
    const received = await svc.receive(row.id, userA.id, today(), 75000);
    expect(received.amount).toBe(75000);
    expect(received.moneyStatus).toBe('RECEIVED');
  });
});
