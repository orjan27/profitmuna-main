import { describe, it, expect, beforeEach } from 'vitest';
import { createExpenseService } from '@/services/expense-service';
import { createExpenseSchema } from '@/schemas/expense';
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
  let walletId: number;

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

    // Seed a wallet owned by the primary user (Paid with target)
    const [wallet] = db
      .insert(schema.wallets)
      .values({ name: 'Default', userId, isDefault: true, color: '#10b981', sortOrder: 0 })
      .returning()
      .all();
    walletId = wallet.id;
  });

  // ─── EXP-01: create ─────────────────────────────────────────────────────────

  it('EXP-01: creates an expense storing amount in cents', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 25075, // 250.75 in cents (already converted by web layer)
      expenseDate: makeDate(),
      walletId,
    });

    expect(expense.amount).toBe(25075);
    expect(expense.categoryName).toBe('Food');
    expect(expense.deletedAt).toBeNull();
  });

  it('EXP-01: denormalizes walletName onto the expense', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });

    expect(expense.walletId).toBe(walletId);
    expect(expense.walletName).toBe('Default');
  });

  it('EXP-01: rejects invalid_category when categoryId belongs to another user', async () => {
    const [otherCat] = db
      .insert(schema.expenseCategories)
      .values({ name: 'Other Cat', userId: otherUserId, system: false })
      .returning()
      .all();

    await expect(
      svc.create(userId, {
        categoryId: otherCat.id,
        amount: 1000,
        expenseDate: makeDate(),
        walletId,
      })
    ).rejects.toMatchObject({ message: 'invalid_category' });
  });

  it('EXP-01: rejects invalid_wallet when walletId belongs to another user', async () => {
    const [otherWallet] = db
      .insert(schema.wallets)
      .values({ name: 'Theirs', userId: otherUserId, color: '#000000', sortOrder: 0 })
      .returning()
      .all();

    await expect(
      svc.create(userId, {
        categoryId,
        amount: 1000,
        expenseDate: makeDate(),
        walletId: otherWallet.id,
      })
    ).rejects.toMatchObject({ message: 'invalid_wallet' });
  });

  it('EXP-01: rejects invalid_wallet when walletId is soft-deleted', async () => {
    const [deleted] = db
      .insert(schema.wallets)
      .values({
        name: 'Gone',
        userId,
        color: '#000000',
        sortOrder: 1,
        deletedAt: new Date().toISOString(),
      })
      .returning()
      .all();

    await expect(
      svc.create(userId, {
        categoryId,
        amount: 1000,
        expenseDate: makeDate(),
        walletId: deleted.id,
      })
    ).rejects.toMatchObject({ message: 'invalid_wallet' });
  });

  // ─── EXP-02: list with date filter ──────────────────────────────────────────

  it('EXP-02: list returns paginated results ordered by expenseDate desc', async () => {
    await svc.create(userId, { categoryId, amount: 1000, expenseDate: '2026-01-01', walletId });
    await svc.create(userId, { categoryId, amount: 2000, expenseDate: '2026-01-10', walletId });
    await svc.create(userId, { categoryId, amount: 3000, expenseDate: '2026-01-15', walletId });

    const result = await svc.list(userId, { page: 0, limit: 10 });
    expect(result.content).toHaveLength(3);
    // Ordered desc: newest first
    expect(result.content[0].expenseDate).toBe('2026-01-15');
    expect(result.content[2].expenseDate).toBe('2026-01-01');
    expect(result.last).toBe(true);
  });

  it('EXP-02: date range filter works', async () => {
    await svc.create(userId, { categoryId, amount: 1000, expenseDate: '2026-01-05', walletId });
    await svc.create(userId, { categoryId, amount: 2000, expenseDate: '2026-02-05', walletId });

    const result = await svc.list(userId, {
      page: 0,
      limit: 10,
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].expenseDate).toBe('2026-01-05');
  });

  it('EXP-02: a legacy NULL-wallet expense still lists', async () => {
    // Insert a row directly with no walletId (mirrors pre-migration legacy rows)
    db.insert(schema.expenses)
      .values({
        categoryId,
        categoryName: 'Food',
        amount: 4200,
        expenseDate: '2026-01-20',
        userId,
        walletId: null,
        walletName: null,
        deletedAt: null,
      })
      .run();

    const result = await svc.list(userId, { page: 0, limit: 20 });
    const legacy = result.content.find((e) => e.amount === 4200);
    expect(legacy).toBeDefined();
    expect(legacy?.walletId).toBeNull();
    expect(legacy?.walletName).toBeNull();
  });

  // ─── EXP-03: update ─────────────────────────────────────────────────────────

  it('EXP-03: update modifies owned expense and re-resolves categoryName', async () => {
    const [cat2] = db
      .insert(schema.expenseCategories)
      .values({ name: 'Transport', userId, system: false })
      .returning()
      .all();

    const created = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });
    const updated = await svc.update(created.id, userId, { categoryId: cat2.id, amount: 5000 });

    expect(updated.amount).toBe(5000);
    expect(updated.categoryName).toBe('Transport');
  });

  it('EXP-03: update re-resolves walletName when walletId changes', async () => {
    const [wallet2] = db
      .insert(schema.wallets)
      .values({ name: 'Savings', userId, color: '#123456', sortOrder: 1 })
      .returning()
      .all();

    const created = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });
    const updated = await svc.update(created.id, userId, { walletId: wallet2.id });

    expect(updated.walletId).toBe(wallet2.id);
    expect(updated.walletName).toBe('Savings');
  });

  it('EXP-03: update rejects editing a soft-deleted expense (CR-05)', async () => {
    const created = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });
    await svc.delete(created.id, userId);

    await expect(svc.update(created.id, userId, { amount: 9999 })).rejects.toMatchObject({
      status: 409,
      message: 'expense_deleted',
    });
  });

  it('EXP-03: update throws not_found for cross-user IDOR', async () => {
    const created = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });

    await expect(svc.update(created.id, otherUserId, { amount: 999 })).rejects.toMatchObject({
      message: 'not_found',
    });
  });

  // ─── EXP-04: soft delete + restore ──────────────────────────────────────────

  it('EXP-04: soft delete sets deletedAt and excludes row from active list', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 5000,
      expenseDate: makeDate(),
      walletId,
    });
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
    const expense = await svc.create(userId, {
      categoryId,
      amount: 5000,
      expenseDate: makeDate(),
      walletId,
    });
    await svc.delete(expense.id, userId);
    const restored = await svc.restore(expense.id, userId);

    expect(restored.deletedAt).toBeNull();

    // Row should appear in active list
    const list = await svc.list(userId, { page: 0, limit: 20 });
    const found = list.content.find((e) => e.id === expense.id);
    expect(found).toBeDefined();
  });

  it('EXP-04: restore rejects an already-active expense (WR-06)', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 5000,
      expenseDate: makeDate(),
      walletId,
    });

    await expect(svc.restore(expense.id, userId)).rejects.toMatchObject({
      status: 409,
      message: 'not_deleted',
    });
  });

  it('EXP-04: soft-deleted expense is excluded from totals', async () => {
    await svc.create(userId, { categoryId, amount: 5000, expenseDate: makeDate(), walletId });
    const toDelete = await svc.create(userId, {
      categoryId,
      amount: 3000,
      expenseDate: makeDate(),
      walletId,
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
    const expense = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });

    await expect(svc.delete(expense.id, otherUserId)).rejects.toMatchObject({
      message: 'not_found',
    });
  });

  it('EXP-04: restore throws not_found for cross-user IDOR', async () => {
    const expense = await svc.create(userId, {
      categoryId,
      amount: 1000,
      expenseDate: makeDate(),
      walletId,
    });
    await svc.delete(expense.id, userId);

    await expect(svc.restore(expense.id, otherUserId)).rejects.toMatchObject({
      message: 'not_found',
    });
  });

  // ─── Schema validation ───────────────────────────────────────────────────────

  it('schema: rejects a missing walletId (required)', () => {
    const result = createExpenseSchema.safeParse({
      categoryId: 1,
      amount: 1000,
      expenseDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('schema: rejects a non-positive walletId', () => {
    const result = createExpenseSchema.safeParse({
      categoryId: 1,
      amount: 1000,
      expenseDate: '2026-01-01',
      walletId: 0,
    });
    expect(result.success).toBe(false);
  });

  it('schema: accepts a valid expense with walletId', () => {
    const result = createExpenseSchema.safeParse({
      categoryId: 1,
      amount: 1000,
      expenseDate: '2026-01-01',
      walletId: 3,
    });
    expect(result.success).toBe(true);
  });
});
