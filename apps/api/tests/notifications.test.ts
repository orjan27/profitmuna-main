import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

import { createTestDb, mockEnv, seedUser } from './helpers/db';
import { schema } from '@app/db';

// Minimal Resend mock so auth-service email calls don't throw
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// RED: createNotificationService does not exist yet — this suite will fail on import
import { createNotificationService } from '@/services/notification-service';

// ─── NOTIF-01: In-app notification center ───────────────────────────────────

describe('NOTIF-01: getUnreadCount', () => {
  it('counts only unread notifications scoped to userId', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'notif01@test.com', name: 'Notif User' });
    const svc = createNotificationService(d1);

    // Insert two unread and one read notification
    await svc.create(user.id, 'INCOME_REMINDER', 'Reminder 1', 'Log your income', '/income');
    await svc.create(user.id, 'INCOME_REMINDER', 'Reminder 2', 'Log your income', '/income');
    const notifs = await svc.list(user.id, { unreadOnly: false });
    // Mark first as read
    await svc.markAsRead(notifs[0].id, user.id);

    const count = await svc.getUnreadCount(user.id);
    expect(count).toBe(1);
  });
});

describe('NOTIF-01: markAsRead', () => {
  it('flips read flag and is scoped to userId (IDOR prevention)', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'notif02a@test.com', name: 'Notif User A' });
    const otherUser = seedUser(db, { email: 'notif02b@test.com', name: 'Notif User B' });
    const svc = createNotificationService(d1);

    await svc.create(user.id, 'INCOME_REMINDER', 'Reminder', 'Log your income', '/income');
    const [notif] = await svc.list(user.id, { unreadOnly: false });

    // markAsRead with wrong userId should not flip the flag
    await svc.markAsRead(notif.id, otherUser.id);
    const stillUnread = await svc.getUnreadCount(user.id);
    expect(stillUnread).toBe(1);

    // markAsRead with correct userId should flip the flag
    await svc.markAsRead(notif.id, user.id);
    const nowRead = await svc.getUnreadCount(user.id);
    expect(nowRead).toBe(0);
  });
});

describe('NOTIF-01: markAllAsRead', () => {
  it('sets all unread notifications to read for the user', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'notif03@test.com', name: 'Notif User C' });
    const svc = createNotificationService(d1);

    await svc.create(user.id, 'INCOME_REMINDER', 'R1', 'Log income', '/income');
    await svc.create(user.id, 'INCOME_REMINDER', 'R2', 'Log income', '/income');
    await svc.create(user.id, 'PENDING_INCOME_DUE', 'Due', 'Mark received', '/income');

    await svc.markAllAsRead(user.id);

    const count = await svc.getUnreadCount(user.id);
    expect(count).toBe(0);
  });
});

describe('NOTIF-01: list', () => {
  it('orders notifications newest-first', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'notif04@test.com', name: 'Notif User D' });
    const svc = createNotificationService(d1);

    await svc.create(user.id, 'INCOME_REMINDER', 'First', 'First message', '/income');
    await svc.create(user.id, 'INCOME_REMINDER', 'Second', 'Second message', '/income');

    const notifs = await svc.list(user.id, { unreadOnly: false });
    // Newest first — second created should appear first
    expect(notifs[0].title).toBe('Second');
    expect(notifs[1].title).toBe('First');
  });
});
