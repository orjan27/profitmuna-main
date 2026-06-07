import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTestDb, mockEnv, seedUser } from './helpers/db';
import { schema } from '@app/db';

// Mock Resend so email calls don't throw
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// RED: runCron does not exist yet — this suite will fail on import
import { runCron } from '@/services/cron-service';

// ─── NOTIF-02: Cron due-user reminder logic ──────────────────────────────────

describe('NOTIF-02: runCron — income reminder emails', () => {
  it('sends reminder email to daily user due at the matching Manila hour', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);

    // Seed a user with daily reminder at hour 9 Manila time
    const user = seedUser(db, { email: 'cron01@test.com', name: 'Cron User', emailVerified: true });
    db.update(schema.users)
      .set({
        reminderEnabled: true,
        reminderFrequency: 'DAILY',
        reminderHour: 9,
      })
      .where(
        // @ts-expect-error — schema.users.id is typed correctly at runtime
        // intentional: direct db update for test seeding
        require('drizzle-orm').eq(schema.users.id, user.id)
      )
      .run();

    // Force Manila hour to 9 by injecting a fixed "now" (09:00 Manila = 01:00 UTC)
    // The cron service must accept an optional "now" param for testability
    const manilaHour9AsUtc = new Date('2026-06-10T01:00:00.000Z'); // 01:00 UTC = 09:00 Manila

    await runCron(env, manilaHour9AsUtc);

    // Verify Resend was called once for this user
    const { Resend } = await import('resend');
    const mockInstance = vi.mocked(Resend).mock.results[0].value as {
      emails: { send: ReturnType<typeof vi.fn> };
    };
    expect(mockInstance.emails.send).toHaveBeenCalledOnce();
    expect(mockInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'cron01@test.com' })
    );
  });

  it('does not send reminder to user not due at current Manila hour', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);

    // Seed user with daily reminder at hour 10, but cron runs at hour 9
    const user = seedUser(db, {
      email: 'cron02@test.com',
      name: 'Not Due User',
      emailVerified: true,
    });
    db.update(schema.users)
      .set({ reminderEnabled: true, reminderFrequency: 'DAILY', reminderHour: 10 })
      // intentional: direct db update for test seeding
      .where(require('drizzle-orm').eq(schema.users.id, user.id))
      .run();

    const manilaHour9AsUtc = new Date('2026-06-10T01:00:00.000Z'); // 09:00 Manila

    vi.clearAllMocks();
    await runCron(env, manilaHour9AsUtc);

    const { Resend } = await import('resend');
    const mockInstance = vi.mocked(Resend).mock.results[0].value as {
      emails: { send: ReturnType<typeof vi.fn> };
    };
    expect(mockInstance.emails.send).not.toHaveBeenCalled();
  });
});

// ─── NOTIF-02: Pending-income-due dedup ─────────────────────────────────────

describe('NOTIF-02: runCron — pending-income-due dedup', () => {
  it('creates one notification for pending income due today, not on second run', async () => {
    const { d1, db, dbD1 } = createTestDb();
    const env = mockEnv({}, d1);

    const user = seedUser(db, {
      email: 'cron03@test.com',
      name: 'Dedup User',
      emailVerified: true,
    });

    // Seed an income category first
    db.insert(schema.incomeCategories).values({ name: 'Salary', userId: user.id }).run();
    const [cat] = db.select().from(schema.incomeCategories).all();

    // Seed a pending income expected today (Manila date: 2026-06-10)
    db.insert(schema.incomes)
      .values({
        categoryId: cat.id,
        categoryName: 'Salary',
        amount: 100000,
        incomeDate: '2026-06-10',
        moneyStatus: 'PENDING',
        expectedReleaseDate: '2026-06-10',
        userId: user.id,
      })
      .run();

    // 2026-06-10 00:00 Manila = 2026-06-09 16:00 UTC
    const manilaDate10AsUtc = new Date('2026-06-09T16:00:00.000Z');

    // First run — should create the notification
    await runCron(env, manilaDate10AsUtc);

    // Import notification service to count
    const { createNotificationService } = await import('@/services/notification-service');
    const notifSvc = createNotificationService(d1);
    const afterFirst = await notifSvc.list(user.id, { unreadOnly: false });
    expect(afterFirst.filter((n) => n.type === 'PENDING_INCOME_DUE')).toHaveLength(1);

    // Second run at the same date — dedup guard should prevent a duplicate
    await runCron(env, manilaDate10AsUtc);
    const afterSecond = await notifSvc.list(user.id, { unreadOnly: false });
    expect(afterSecond.filter((n) => n.type === 'PENDING_INCOME_DUE')).toHaveLength(1);
  });

  it('calls email send for each due reminder user (mock Resend verification)', async () => {
    const { d1, db } = createTestDb();
    const env = mockEnv({}, d1);

    // Seed two users both with daily reminder at hour 9
    const userA = seedUser(db, { email: 'cronA@test.com', name: 'User A', emailVerified: true });
    const userB = seedUser(db, { email: 'cronB@test.com', name: 'User B', emailVerified: true });

    for (const u of [userA, userB]) {
      db.update(schema.users)
        .set({ reminderEnabled: true, reminderFrequency: 'DAILY', reminderHour: 9 })
        .where(require('drizzle-orm').eq(schema.users.id, u.id))
        .run();
    }

    vi.clearAllMocks();
    const manilaHour9AsUtc = new Date('2026-06-10T01:00:00.000Z');
    await runCron(env, manilaHour9AsUtc);

    const { Resend } = await import('resend');
    const mockInstance = vi.mocked(Resend).mock.results[0].value as {
      emails: { send: ReturnType<typeof vi.fn> };
    };
    // One email per due user
    expect(mockInstance.emails.send).toHaveBeenCalledTimes(2);
  });
});
