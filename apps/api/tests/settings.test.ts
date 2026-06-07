import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

import { createTestDb, mockEnv, seedUser } from './helpers/db';

// Minimal Resend mock so auth-service email calls don't throw
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  })),
}));

// RED: createSettingsService does not exist yet — this suite will fail on import
import { createSettingsService } from '@/services/settings-service';

// ─── SET-01: Display currency ────────────────────────────────────────────────

describe('SET-01: getSettings — default currency', () => {
  it('returns PHP as default display currency for a new user', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'set01@test.com', name: 'Set User' });
    const svc = createSettingsService({ DB: d1 } as Parameters<typeof createSettingsService>[0]);
    const settings = await svc.getSettings(user.id);
    expect(settings.displayCurrency).toBe('PHP');
  });

  it('updateSettings persists displayCurrency change', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'set01b@test.com', name: 'Set User B' });
    const svc = createSettingsService({ DB: d1 } as Parameters<typeof createSettingsService>[0]);
    const updated = await svc.updateSettings(user.id, { displayCurrency: 'USD' });
    expect(updated.displayCurrency).toBe('USD');
  });
});

// ─── SET-02: Reminder schedule ───────────────────────────────────────────────

describe('SET-02: updateSettings — reminder schedule', () => {
  it('persists daily reminderFrequency and hour', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'set02a@test.com', name: 'Set User C' });
    const svc = createSettingsService({ DB: d1 } as Parameters<typeof createSettingsService>[0]);
    const updated = await svc.updateSettings(user.id, {
      reminderEnabled: true,
      reminderFrequency: 'DAILY',
      reminderHour: 9,
    });
    expect(updated.reminderEnabled).toBe(true);
    expect(updated.reminderFrequency).toBe('DAILY');
    expect(updated.reminderHour).toBe(9);
  });

  it('persists weekly reminderFrequency, dayOfWeek, and hour', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'set02b@test.com', name: 'Set User D' });
    const svc = createSettingsService({ DB: d1 } as Parameters<typeof createSettingsService>[0]);
    const updated = await svc.updateSettings(user.id, {
      reminderEnabled: true,
      reminderFrequency: 'WEEKLY',
      reminderDayOfWeek: 1, // Monday
      reminderHour: 8,
    });
    expect(updated.reminderFrequency).toBe('WEEKLY');
    expect(updated.reminderDayOfWeek).toBe(1);
    expect(updated.reminderHour).toBe(8);
  });

  it('persists bi-weekly reminderFrequency, both days of month, and hour', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'set02d@test.com', name: 'Set User F' });
    const svc = createSettingsService({ DB: d1 } as Parameters<typeof createSettingsService>[0]);
    const updated = await svc.updateSettings(user.id, {
      reminderEnabled: true,
      reminderFrequency: 'BIWEEKLY',
      reminderDayOfMonth: 15,
      reminderDayOfMonth2: 28,
      reminderHour: 9,
    });
    expect(updated.reminderFrequency).toBe('BIWEEKLY');
    expect(updated.reminderDayOfMonth).toBe(15);
    expect(updated.reminderDayOfMonth2).toBe(28);
    expect(updated.reminderHour).toBe(9);
  });

  it('persists monthly reminderFrequency, dayOfMonth, and hour', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, { email: 'set02c@test.com', name: 'Set User E' });
    const svc = createSettingsService({ DB: d1 } as Parameters<typeof createSettingsService>[0]);
    const updated = await svc.updateSettings(user.id, {
      reminderEnabled: true,
      reminderFrequency: 'MONTHLY',
      reminderDayOfMonth: 15,
      reminderHour: 10,
    });
    expect(updated.reminderFrequency).toBe('MONTHLY');
    expect(updated.reminderDayOfMonth).toBe(15);
    expect(updated.reminderHour).toBe(10);
  });
});
