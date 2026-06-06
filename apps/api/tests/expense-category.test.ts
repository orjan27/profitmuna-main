import { describe, it, expect } from 'vitest';
import { expenses, expenseCategories } from '@app/db/schema';
import { createTestDb, seedUser } from './helpers/db';
import { createExpenseCategoryService } from '../src/services/expense-category-service';

const USER_A_EMAIL = 'exp-cat-user-a@test.com';
const USER_B_EMAIL = 'exp-cat-user-b@test.com';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

describe('expense category service — seeding', () => {
  it('seeds default categories on first list() for a user with no categories', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cats = await svc.list(userA.id);

    expect(cats.length).toBeGreaterThan(0);
    const names = cats.map((c) => c.name);
    expect(names).toContain('Housing');
    expect(names).toContain('Food');
    expect(names).toContain('Transportation');
    expect(names).toContain('Utilities');
    expect(names).toContain('Healthcare');
    expect(names).toContain('Entertainment');
    expect(names).toContain('Other');
    expect(cats.every((c) => c.system)).toBe(true);
  });

  it('does not duplicate defaults on a second list() call', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const firstCall = await svc.list(userA.id);
    const secondCall = await svc.list(userA.id);

    expect(secondCall.length).toBe(firstCall.length);
  });

  it('seeds independently per user', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const svc = createExpenseCategoryService(dbD1);
    await svc.list(userA.id);
    const catsB = await svc.list(userB.id);

    const allBelongToB = catsB.every((c) => c.userId === userB.id);
    expect(allBelongToB).toBe(true);
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────

describe('expense category service — create', () => {
  it('creates a custom category (system = false) for the user', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    await svc.list(userA.id); // seed first
    const cat = await svc.create(userA.id, 'Subscriptions');

    expect(cat.name).toBe('Subscriptions');
    expect(cat.system).toBe(false);
    expect(cat.userId).toBe(userA.id);
  });
});

// ─── Cascade rename ───────────────────────────────────────────────────────────

describe('expense category service — cascade rename (D-13)', () => {
  it('renaming a custom category cascades categoryName to existing expense rows', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cat = await svc.create(userA.id, 'Groceries');

    await db.insert(expenses).values({
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 5000,
      expenseDate: today(),
      userId: userA.id,
    });

    const renamed = await svc.update(cat.id, userA.id, 'Supermarket');
    expect(renamed.name).toBe('Supermarket');

    const [expenseRow] = await db
      .select({ categoryName: expenses.categoryName })
      .from(expenses)
      .where(
        (await import('drizzle-orm')).and(
          (await import('drizzle-orm')).eq(expenses.categoryId, cat.id),
          (await import('drizzle-orm')).eq(expenses.userId, userA.id)
        )
      );
    expect(expenseRow?.categoryName).toBe('Supermarket');
  });
});

// ─── Block delete in-use ──────────────────────────────────────────────────────

describe('expense category service — block delete in-use (D-12)', () => {
  it('throws 400 category_in_use when deleting a category with expense records', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cat = await svc.create(userA.id, 'Groceries');

    await db.insert(expenses).values({
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 5000,
      expenseDate: today(),
      userId: userA.id,
    });

    await expect(svc.delete(cat.id, userA.id)).rejects.toMatchObject({
      status: 400,
      message: 'category_in_use',
    });
  });

  it('allows deleting a category whose only expenses are soft-deleted (CR-04)', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cat = await svc.create(userA.id, 'Groceries');

    await db.insert(expenses).values({
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 5000,
      expenseDate: today(),
      userId: userA.id,
      deletedAt: new Date().toISOString(),
    });

    await svc.delete(cat.id, userA.id);

    const remaining = await svc.list(userA.id);
    expect(remaining.some((c) => c.id === cat.id)).toBe(false);
  });

  it('deletes an unused custom category successfully', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cat = await svc.create(userA.id, 'UnusedCategory');

    await svc.delete(cat.id, userA.id);

    const remaining = await svc.list(userA.id);
    expect(remaining.some((c) => c.id === cat.id)).toBe(false);
  });
});

// ─── System protection ────────────────────────────────────────────────────────

describe('expense category service — system protection (T-02-18)', () => {
  it('throws 400 cannot_edit_system_category when renaming a system default', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cats = await svc.list(userA.id);
    const systemCat = cats.find((c) => c.system)!;

    await expect(svc.update(systemCat.id, userA.id, 'NewName')).rejects.toMatchObject({
      status: 400,
      message: 'cannot_edit_system_category',
    });
  });

  it('throws 400 cannot_delete_system_category when deleting a system default', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createExpenseCategoryService(dbD1);
    const cats = await svc.list(userA.id);
    const systemCat = cats.find((c) => c.system)!;

    await expect(svc.delete(systemCat.id, userA.id)).rejects.toMatchObject({
      status: 400,
      message: 'cannot_delete_system_category',
    });
  });
});

// ─── IDOR ─────────────────────────────────────────────────────────────────────

describe('expense category service — IDOR (T-02-16)', () => {
  it("returns 404 when accessing another user's category for update", async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const svc = createExpenseCategoryService(dbD1);
    const catA = await svc.create(userA.id, 'Groceries');

    await expect(svc.update(catA.id, userB.id, 'Hijacked')).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 404 when accessing another user's category for delete", async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const svc = createExpenseCategoryService(dbD1);
    const catA = await svc.create(userA.id, 'Groceries');

    await expect(svc.delete(catA.id, userB.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
