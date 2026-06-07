import { z } from 'zod';

const CURRENCY_CODES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'CAD'] as const;

export const updateSettingsSchema = z.object({
  displayCurrency: z.enum(CURRENCY_CODES).optional(),
  reminderEnabled: z.boolean().optional(),
  // Nullable: the form sends null to clear the schedule when reminders are disabled
  reminderFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
  reminderDayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  // Max 28 caps the day-31 short-month pitfall at the boundary (Pitfall 6)
  reminderDayOfMonth: z.number().int().min(1).max(28).optional().nullable(),
  reminderHour: z.number().int().min(0).max(23).optional().nullable(),
});
