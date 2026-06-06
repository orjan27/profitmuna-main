import { describe, it, expect } from 'vitest';
import { incomes, incomeCategories } from '@app/db/schema';
import { createTestDb, seedUser } from './helpers/db';
import { createIncomeCategoryService } from '../src/services/income-category-service';

const USER_A_EMAIL = 'cat-user-a@test.com';
const USER_B_EMAIL = 'cat-user-b@test.com';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

describe('income category service — seeding', () => {
  it('seeds default categories on first list() for a user with no categories', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    const cats = await svc.list(userA.id);

    expect(cats.length).toBeGreaterThan(0);
    const names = cats.map((c) => c.name);
    expect(names).toContain('Salary');
    expect(names).toContain('Freelance');
    expect(names).toContain('Business');
    expect(names).toContain('Gifts');
    expect(names).toContain('Other');
    // All seeded categories have system = true
    expect(cats.every((c) => c.system)).toBe(true);
  });

  it('does not duplicate defaults on a second list() call', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    const firstCall = await svc.list(userA.id);
    const secondCall = await svc.list(userA.id);

    expect(secondCall.length).toBe(firstCall.length);
  });

  it('seeds independently per user (userA defaults do not appear in userB list)', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const svc = createIncomeCategoryService(dbD1);
    await svc.list(userA.id);
    const catsB = await svc.list(userB.id);

    // UserB also gets seeded — categories belong to userB only
    const allBelongToB = catsB.every((c) => c.userId === userB.id);
    expect(allBelongToB).toBe(true);
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────

describe('income category service — create', () => {
  it('creates a custom category (system = false) for the user', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    await svc.list(userA.id); // seed first
    const cat = await svc.create(userA.id, 'Consulting');

    expect(cat.name).toBe('Consulting');
    expect(cat.system).toBe(false);
    expect(cat.userId).toBe(userA.id);
  });

  it('throws 409 category_exists on a duplicate name (WR-04)', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    await svc.list(userA.id); // seed defaults including 'Salary'

    await expect(svc.create(userA.id, 'Salary')).rejects.toMatchObject({
      status: 409,
      message: 'category_exists',
    });
  });
});

// ─── Cascade rename ───────────────────────────────────────────────────────────

describe('income category service — cascade rename (D-13)', () => {
  it('renaming a custom category cascades categoryName to existing income rows', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    // Create a custom category
    const cat = await svc.create(userA.id, 'Consulting');

    // Insert an income row referencing that category
    await db.insert(incomes).values({
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 100000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      userId: userA.id,
    });

    // Rename the category
    const renamed = await svc.update(cat.id, userA.id, 'Advisory');
    expect(renamed.name).toBe('Advisory');

    // The income row's categoryName should also be updated
    const [incomeRow] = await db
      .select({ categoryName: incomes.categoryName })
      .from(incomes)
      .where(
        (await import('drizzle-orm')).and(
          (await import('drizzle-orm')).eq(incomes.categoryId, cat.id),
          (await import('drizzle-orm')).eq(incomes.userId, userA.id)
        )
      );
    expect(incomeRow?.categoryName).toBe('Advisory');
  });
});

// ─── Block delete in-use ──────────────────────────────────────────────────────

describe('income category service — block delete in-use (D-12)', () => {
  it('throws 400 category_in_use when deleting a category that has income records', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    const cat = await svc.create(userA.id, 'Consulting');

    // Insert an income that uses this category
    await db.insert(incomes).values({
      categoryId: cat.id,
      categoryName: cat.name,
      amount: 100000,
      incomeDate: today(),
      moneyStatus: 'PENDING',
      userId: userA.id,
    });

    await expect(svc.delete(cat.id, userA.id)).rejects.toMatchObject({
      status: 400,
      message: 'category_in_use',
    });
  });

  it('deletes an unused custom category successfully', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
    const cat = await svc.create(userA.id, 'UnusedCategory');

    await svc.delete(cat.id, userA.id);

    const remaining = await svc.list(userA.id);
    expect(remaining.some((c) => c.id === cat.id)).toBe(false);
  });
});

// ─── System protection ────────────────────────────────────────────────────────

describe('income category service — system protection (T-02-18)', () => {
  it('throws 400 cannot_edit_system_category when renaming a system default', async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;

    const svc = createIncomeCategoryService(dbD1);
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

    const svc = createIncomeCategoryService(dbD1);
    const cats = await svc.list(userA.id);
    const systemCat = cats.find((c) => c.system)!;

    await expect(svc.delete(systemCat.id, userA.id)).rejects.toMatchObject({
      status: 400,
      message: 'cannot_delete_system_category',
    });
  });
});

// ─── IDOR ─────────────────────────────────────────────────────────────────────

describe('income category service — IDOR (T-02-16)', () => {
  it("returns 404 when accessing another user's category for update", async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const svc = createIncomeCategoryService(dbD1);
    const catA = await svc.create(userA.id, 'Consulting');

    await expect(svc.update(catA.id, userB.id, 'Hijacked')).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 404 when accessing another user's category for delete", async () => {
    const { db, dbD1 } = createTestDb();
    const userA = seedUser(db, { email: USER_A_EMAIL, name: 'User A' })!;
    const userB = seedUser(db, { email: USER_B_EMAIL, name: 'User B' })!;

    const svc = createIncomeCategoryService(dbD1);
    const catA = await svc.create(userA.id, 'Consulting');

    await expect(svc.delete(catA.id, userB.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
