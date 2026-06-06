import { describe, it, expect, beforeEach } from 'vitest';
import { createExpenseService } from '@/services/expense-service';
import { createExpenseSchema, PAYMENT_METHOD_VALUES } from '@/schemas/expense';
import { createTestDb, seedUser } from './helpers/db';
import { schema } from '@app/db';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('expense service (EXP-01..04 + IDOR)', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let svc: ReturnType<typeof createExpenseService>;
  let userId: number;
  let otherUserId: number;
  let categoryId: number;

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    svc = createExpenseService(db);

    const user = seedUser(db, { email: 'user@test.com', name: 'User', emailVerified: true });
    const other = seedUser(db, { email: 'other@test.com', name: 'Other', emailVerified: true });
    userId = user.id;
    otherUserId = other.id;

    // Seed an expense category owned by the primary user
    const [cat] = db
      .insert(schema.expenseCategories)
      .values({ name: 'Food', userId, system: false })
      .returning()
      .all();
    categoryId = cat.id;
  });

  // ─── EXP-01: create ─────────────────────────────────────────────────────────

  it('EXP-01: creates an expense storing amount in cents', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 25075, // 250.75 in cents (already converted by web layer)
      expenseDate: makeDate(),
      paymentMethod: 'gcash',
    });

    expect(expense.amount).toBe(25075);
    expect(expense.categoryName).toBe('Food');
    expect(expense.paymentMethod).toBe('gcash');
    expect(expense.deletedAt).toBeNull();
  });

  it('EXP-01: stores null paymentMethod when omitted', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
    });

    expect(expense.paymentMethod).toBeNull();
  });

  it('EXP-01: rejects invalid_category when categoryId belongs to another user', async () => {
    const [otherCat] = db
      .insert(schema.expenseCategories)
      .values({ name: 'Other Cat', userId: otherUserId, system: false })
      .returning()
      .all();

    await expect(
      svc.create(userId, { categoryId: otherCat.id, amount: 1000, expenseDate: makeDate() })
    ).rejects.toMatchObject({ message: 'invalid_category' });
  });

  // ─── EXP-02: list with date filter ──────────────────────────────────────────

  it('EXP-02: list returns paginated results ordered by expenseDate desc', async () => {
    await svc.create(userId, { categoryId, amount: 1000, expenseDate: '2026-01-01' });
    await svc.create(userId, { categoryId, amount: 2000, expenseDate: '2026-01-10' });
    await svc.create(userId, { categoryId, amount: 3000, expenseDate: '2026-01-15' });

    const result = await svc.list(userId, { page: 0, limit: 10 });
    expect(result.content).toHaveLength(3);
    // Ordered desc: newest first
    expect(result.content[0].expenseDate).toBe('2026-01-15');
    expect(result.content[2].expenseDate).toBe('2026-01-01');
    expect(result.last).toBe(true);
  });

  it('EXP-02: date range filter works', async () => {
    await svc.create(userId, { categoryId, amount: 1000, expenseDate: '2026-01-05' });
    await svc.create(userId, { categoryId, amount: 2000, expenseDate: '2026-02-05' });

    const result = await svc.list(userId, {
      page: 0,
      limit: 10,
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].expenseDate).toBe('2026-01-05');
  });

  // ─── EXP-03: update ─────────────────────────────────────────────────────────

  it('EXP-03: update modifies owned expense and re-resolves categoryName', async () => {
    const [cat2] = db
      .insert(schema.expenseCategories)
      .values({ name: 'Transport', userId, system: false })
      .returning()
      .all();

    const created = await svc.create(userId, { categoryId, amount: 1000, expenseDate: makeDate() });
    const updated = await svc.update(created.id, userId, { categoryId: cat2.id, amount: 5000 });

    expect(updated.amount).toBe(5000);
    expect(updated.categoryName).toBe('Transport');
  });

  it('EXP-03: update rejects editing a soft-deleted expense (CR-05)', async () => {
    const created = await svc.create(userId, { categoryId, amount: 1000, expenseDate: makeDate() });
    await svc.delete(created.id, userId);

    await expect(svc.update(created.id, userId, { amount: 9999 })).rejects.toMatchObject({
      status: 409,
      message: 'expense_deleted',
    });
  });

  it('EXP-03: update throws not_found for cross-user IDOR', async () => {
    const created = await svc.create(userId, { categoryId, amount: 1000, expenseDate: makeDate() });

    await expect(svc.update(created.id, otherUserId, { amount: 999 })).rejects.toMatchObject({
      message: 'not_found',
    });
  });

  // ─── EXP-04: soft delete + restore ──────────────────────────────────────────

  it('EXP-04: soft delete sets deletedAt and excludes row from active list', async () => {
    const expense = await svc.create(userId, { categoryId, amount: 5000, expenseDate: makeDate() });
    await svc.delete(expense.id, userId);

    // Active list must not include deleted row
    const list = await svc.list(userId, { page: 0, limit: 20 });
    const found = list.content.find((e) => e.id === expense.id && !e.deletedAt);
    expect(found).toBeUndefined();

    // Verify deletedAt is set in DB
    const dbRow = db.query.expenses.findFirst({
      where: (t, { eq }) => eq(t.id, expense.id),
    });
    const row = await dbRow;
    expect(row?.deletedAt).not.toBeNull();
  });

  it('EXP-04: restore clears deletedAt and row returns to active list', async () => {
    const expense = await svc.create(userId, { categoryId, amount: 5000, expenseDate: makeDate() });
    await svc.delete(expense.id, userId);
    const restored = await svc.restore(expense.id, userId);

    expect(restored.deletedAt).toBeNull();

    // Row should appear in active list
    const list = await svc.list(userId, { page: 0, limit: 20 });
    const found = list.content.find((e) => e.id === expense.id);
    expect(found).toBeDefined();
  });

  it('EXP-04: soft-deleted expense is excluded from totals', async () => {
    await svc.create(userId, { categoryId, amount: 5000, expenseDate: makeDate() });
    const toDelete = await svc.create(userId, {
      categoryId,
      amount: 3000,
      expenseDate: makeDate(),
    });
    await svc.delete(toDelete.id, userId);

    const list = await svc.list(userId, { page: 0, limit: 20 });
    // Only 5000 should be in active list (soft-deleted rows may appear with deletedAt set)
    const activeTotal = list.content
      .filter((e) => e.deletedAt === null)
      .reduce((sum, e) => sum + e.amount, 0);
    expect(activeTotal).toBe(5000);
  });

  it('EXP-04: delete throws not_found for cross-user IDOR', async () => {
    const expense = await svc.create(userId, { categoryId, amount: 1000, expenseDate: makeDate() });

    await expect(svc.delete(expense.id, otherUserId)).rejects.toMatchObject({
      message: 'not_found',
    });
  });

  it('EXP-04: restore throws not_found for cross-user IDOR', async () => {
    const expense = await svc.create(userId, { categoryId, amount: 1000, expenseDate: makeDate() });
    await svc.delete(expense.id, userId);

    await expect(svc.restore(expense.id, otherUserId)).rejects.toMatchObject({
      message: 'not_found',
    });
  });

  // ─── Schema validation ───────────────────────────────────────────────────────

  it('schema: rejects invalid paymentMethod value', () => {
    const result = createExpenseSchema.safeParse({
      categoryId: 1,
      amount: 1000,
      expenseDate: '2026-01-01',
      paymentMethod: 'venmo', // not in the 5 allowed values
    });
    expect(result.success).toBe(false);
  });

  it('schema: allows all 5 valid paymentMethod values', () => {
    for (const method of PAYMENT_METHOD_VALUES) {
      const result = createExpenseSchema.safeParse({
        categoryId: 1,
        amount: 1000,
        expenseDate: '2026-01-01',
        paymentMethod: method,
      });
      expect(result.success).toBe(true);
    }
  });

  it('schema: allows null paymentMethod', () => {
    const result = createExpenseSchema.safeParse({
      categoryId: 1,
      amount: 1000,
      expenseDate: '2026-01-01',
      paymentMethod: null,
    });
    expect(result.success).toBe(true);
  });
});
