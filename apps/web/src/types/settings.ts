import type { CurrencyCode } from '@/lib/format-currency';

// Re-export so consumers only need one import for settings types
export type { CurrencyCode };

/** Shape of the user settings object returned by GET /api/settings. */
export interface UserSettings {
  displayCurrency: CurrencyCode;
  reminderEnabled: boolean;
  reminderFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  reminderDayOfWeek: number | null;
  reminderDayOfMonth: number | null;
  reminderDayOfMonth2: number | null;
  reminderHour: number | null;
}
