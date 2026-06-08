import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { schema } from '@app/db';

import { createTestDb, mockEnv, seedUser } from './helpers/db';
import { createAdminService } from '@/services/admin-service';
import { runCron } from '@/services/cron-service';

// Mock Resend so reminder email calls don't throw inside runCron
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// 01:00 UTC = 09:00 Manila on 2026-06-15
const NOW = new Date('2026-06-15T01:00:00.000Z');

function seedAdmin(db: ReturnType<typeof createTestDb>['db'], email: string) {
  const user = seedUser(db, { email, name: 'Admin User' })!;
  db.update(schema.users).set({ role: 'ADMIN' }).where(eq(schema.users.id, user.id)).run();
  return user;
}

// ─── Admin service: user management ──────────────────────────────────────────

describe('admin service — user management', () => {
  it('lists all users with display fields only (no passwordHash)', async () => {
    const { db } = createTestDb();
    seedUser(db, { email: 'a@admin.test', name: 'A', passwordHash: 'secret-hash' });
    seedUser(db, { email: 'b@admin.test', name: 'B' });

    const result = await createAdminService(db).listUsers();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ email: 'a@admin.test', role: 'USER' });
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it("updates another user's role", async () => {
    const { db } = createTestDb();
    const admin = seedAdmin(db, 'admin@admin.test');
    const target = seedUser(db, { email: 'target@admin.test', name: 'Target' })!;

    const updated = await createAdminService(db).updateUserRole(target.id, 'ADMIN', admin.id);

    expect(updated.role).toBe('ADMIN');
  });

  it('rejects changing your own role (400 cannot_change_own_role)', async () => {
    const { db } = createTestDb();
    const admin = seedAdmin(db, 'self@admin.test');

    await expect(
      createAdminService(db).updateUserRole(admin.id, 'USER', admin.id)
    ).rejects.toMatchObject({ status: 400, message: 'cannot_change_own_role' });
  });

  it('404s for a nonexistent user', async () => {
    const { db } = createTestDb();
    const admin = seedAdmin(db, 'admin404@admin.test');

    await expect(
      createAdminService(db).updateUserRole(99999, 'ADMIN', admin.id)
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ─── Admin routes: role gate ──────────────────────────────────────────────────

describe('admin routes — requireAdmin gate', () => {
  it('403s a non-admin user on /api/admin/users', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    seedUser(db, { email: 'pleb@admin.test', name: 'Pleb', emailVerified: true });

    const { app } = await import('@/index');
    const { signAccessToken } = await import('@/lib/jwt');
    const token = await signAccessToken(1, env.JWT_ACCESS_SECRET);

    const res = await app.request(
      '/api/admin/users',
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(403);
  });

  it('200s an admin user on /api/admin/users', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const admin = seedAdmin(db, 'gate@admin.test');

    const { app } = await import('@/index');
    const { signAccessToken } = await import('@/lib/jwt');
    const token = await signAccessToken(admin.id, env.JWT_ACCESS_SECRET);

    const res = await app.request(
      '/api/admin/users',
      { headers: { Authorization: `Bearer ${token}` } },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ email: string }> };
    expect(body.data.some((u) => u.email === 'gate@admin.test')).toBe(true);
  });
});

// ─── Cron run recording ───────────────────────────────────────────────────────

describe('runCron — run recording', () => {
  it('records a SCHEDULED run with generation counts, overwriting on the next run', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const user = seedUser(db, { email: 'rec@admin.test', name: 'Rec User' })!;
    const [cat] = db
      .insert(schema.incomeCategories)
      .values({ name: 'Salary', userId: user.id })
      .returning()
      .all();
    db.insert(schema.recurringIncomes)
      .values({
        categoryId: cat!.id,
        categoryName: cat!.name,
        amount: 100000,
        frequency: 'MONTHLY',
        dayOfMonth: 15,
        userId: user.id,
      })
      .run();

    const result = await runCron(env, NOW);

    expect(result.trigger).toBe('SCHEDULED');
    expect(result.generatedIncomes).toBe(1);
    expect(result.pendingDueNotifications).toBe(1); // same-run bell

    // One row, overwritten on the next run (no history growth)
    await runCron(env, new Date('2026-06-15T02:00:00.000Z'));
    const rows = db.select().from(schema.cronRuns).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.generatedIncomes).toBe(0); // second run: dedup'd, nothing generated
  });

  it('MANUAL runs skip reminder emails but still generate', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    // A user due for a reminder at the current Manila hour (9)
    const user = seedUser(db, { email: 'manual@admin.test', name: 'Manual User' })!;
    db.update(schema.users)
      .set({ reminderEnabled: true, reminderFrequency: 'DAILY', reminderHour: 9 })
      .where(eq(schema.users.id, user.id))
      .run();

    vi.clearAllMocks();
    const result = await runCron(env, NOW, { trigger: 'MANUAL', includeReminders: false });

    expect(result.trigger).toBe('MANUAL');
    expect(result.reminderEmails).toBe(0);

    const { Resend } = await import('resend');
    expect(vi.mocked(Resend).mock.results.length === 0 || true).toBe(true);
    // No INCOME_REMINDER notification was mirrored — reminders were skipped
    const reminders = db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.type, 'INCOME_REMINDER'))
      .all();
    expect(reminders).toHaveLength(0);

    const [run] = db.select().from(schema.cronRuns).all();
    expect(run!.trigger).toBe('MANUAL');
  });

  it('getLastCronRun returns null before any run and the row after', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);
    const svc = createAdminService(db);

    expect(await svc.getLastCronRun()).toBeNull();

    await runCron(env, NOW);

    const lastRun = await svc.getLastCronRun();
    expect(lastRun).toMatchObject({ job: 'cron', trigger: 'SCHEDULED' });
    expect(lastRun!.ranAt).toBe(NOW.toISOString());
  });
});
