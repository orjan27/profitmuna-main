'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserSettings, CurrencyCode } from '@/types/settings';

interface SettingsFormProps {
  initialSettings: UserSettings;
}

const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: 'PHP', label: 'PHP — Philippine Peso (₱)' },
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
  { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
] as const;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

/**
 * Formats an hour (0–23) as 12-hour AM/PM string.
 * Examples: 0 → "12:00 AM", 9 → "9:00 AM", 12 → "12:00 PM", 23 → "11:00 PM"
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
}

/**
 * Formats a day-of-month number as an ordinal string.
 * Examples: 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th"
 */
function formatOrdinal(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/**
 * Client component for the settings form.
 * Two card sections: Display Currency and Income Reminders.
 * Submits via PUT /api/settings; fires success/error toasts; calls router.refresh().
 */
export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Display Currency state
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(
    initialSettings.displayCurrency
  );

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(initialSettings.reminderEnabled);
  const [reminderFrequency, setReminderFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>(
    initialSettings.reminderFrequency ?? 'DAILY'
  );
  const [reminderDayOfWeek, setReminderDayOfWeek] = useState<number>(
    initialSettings.reminderDayOfWeek ?? 1
  );
  const [reminderDayOfMonth, setReminderDayOfMonth] = useState<number>(
    initialSettings.reminderDayOfMonth ?? 1
  );
  const [reminderHour, setReminderHour] = useState<number>(initialSettings.reminderHour ?? 9);

  async function handleSave() {
    setSubmitting(true);
    try {
      const body = reminderEnabled
        ? {
            displayCurrency,
            reminderEnabled: true,
            reminderFrequency,
            reminderDayOfWeek: reminderFrequency === 'WEEKLY' ? reminderDayOfWeek : null,
            reminderDayOfMonth: reminderFrequency === 'MONTHLY' ? reminderDayOfMonth : null,
            reminderHour,
          }
        : {
            displayCurrency,
            reminderEnabled: false,
            reminderFrequency: null,
            reminderDayOfWeek: null,
            reminderDayOfMonth: null,
            reminderHour: null,
          };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Settings save failed');
      }

      toast.success('Settings saved.');
      router.refresh();
    } catch {
      toast.error('Could not save settings. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Card 1: Display Currency */}
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-4">
        <h2 className="text-[20px] font-semibold leading-tight">Display Currency</h2>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Choose how monetary amounts are displayed across the app. This is display-only — no
          conversion is applied.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="display-currency" className="text-sm font-semibold">
            Currency
          </Label>
          <Select
            value={displayCurrency}
            onValueChange={(v) => setDisplayCurrency(v as CurrencyCode)}
          >
            <SelectTrigger id="display-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Card 2: Income Reminders */}
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-4">
        <h2 className="text-[20px] font-semibold leading-tight">Income Reminders</h2>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Receive a reminder email on your chosen schedule. Reminders are sent in Manila time
          (UTC+8).
        </p>

        {/* Enable reminders toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label htmlFor="reminder-enabled" className="text-sm font-semibold cursor-pointer">
            Enable reminders
          </Label>
          <Switch
            id="reminder-enabled"
            checked={reminderEnabled}
            onCheckedChange={setReminderEnabled}
          />
        </div>

        {/* Conditional schedule fields — not mounted when reminders are off */}
        {reminderEnabled ? (
          <div className="flex flex-col gap-4">
            {/* Frequency */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-frequency" className="text-sm font-semibold">
                Frequency
              </Label>
              <Select
                value={reminderFrequency}
                onValueChange={(v) => setReminderFrequency(v as 'DAILY' | 'WEEKLY' | 'MONTHLY')}
              >
                <SelectTrigger id="reminder-frequency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Day of week — WEEKLY only */}
            {reminderFrequency === 'WEEKLY' ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-day-of-week" className="text-sm font-semibold">
                  Day of week
                </Label>
                <Select
                  value={String(reminderDayOfWeek)}
                  onValueChange={(v) => setReminderDayOfWeek(Number(v))}
                >
                  <SelectTrigger id="reminder-day-of-week" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(({ value, label }) => (
                      <SelectItem key={value} value={String(value)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Day of month — MONTHLY only */}
            {reminderFrequency === 'MONTHLY' ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-day-of-month" className="text-sm font-semibold">
                  Day of month
                </Label>
                <Select
                  value={String(reminderDayOfMonth)}
                  onValueChange={(v) => setReminderDayOfMonth(Number(v))}
                >
                  <SelectTrigger id="reminder-day-of-month" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        {formatOrdinal(day)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Reminders are sent on this day each month.
                </p>
              </div>
            ) : null}

            {/* Hour (Manila time) */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-hour" className="text-sm font-semibold">
                Hour (Manila time)
              </Label>
              <Select
                value={String(reminderHour)}
                onValueChange={(v) => setReminderHour(Number(v))}
              >
                <SelectTrigger id="reminder-hour" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHour(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <Button onClick={handleSave} disabled={submitting} className="self-start">
          {submitting ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
