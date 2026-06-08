'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatOrdinal } from '@/lib/format-date';
import type { RecurFrequency } from '@/types/recurring';

// ── Value model ───────────────────────────────────────────────────────────────

/** Controlled value for the Repeat picker. 'NONE' = one-off entry, no template. */
export interface RecurrenceValue {
  frequency: 'NONE' | RecurFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  dayOfMonth2: number | null;
}

export const NO_RECURRENCE: RecurrenceValue = {
  frequency: 'NONE',
  dayOfWeek: null,
  dayOfMonth: null,
  dayOfMonth2: null,
};

/** True when the value is submittable: NONE, or all fields its frequency needs. */
export function recurrenceIsValid(value: RecurrenceValue): boolean {
  switch (value.frequency) {
    case 'NONE':
      return true;
    case 'WEEKLY':
      return value.dayOfWeek !== null;
    case 'BIWEEKLY':
      return (
        value.dayOfMonth !== null &&
        value.dayOfMonth2 !== null &&
        value.dayOfMonth !== value.dayOfMonth2
      );
    case 'MONTHLY':
      return value.dayOfMonth !== null;
  }
}

/** Converts the picker value to the server-action recurrence payload (undefined = no template). */
export function toRecurrenceInput(value: RecurrenceValue):
  | {
      frequency: RecurFrequency;
      dayOfWeek: number | null;
      dayOfMonth: number | null;
      dayOfMonth2: number | null;
    }
  | undefined {
  if (value.frequency === 'NONE') return undefined;
  return {
    frequency: value.frequency,
    dayOfWeek: value.dayOfWeek,
    dayOfMonth: value.dayOfMonth,
    dayOfMonth2: value.dayOfMonth2,
  };
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/** Parses YYYY-MM-DD in local time; falls back to today on malformed input. */
function parseReference(dateStr?: string): Date {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date();
}

/**
 * Seeds day fields from the entry date when the user switches frequency, so
 * "Salary on the 15th, bi-weekly" defaults to the kinsenas pairing (15 & 30)
 * without extra clicks.
 */
export function defaultsForFrequency(
  frequency: 'NONE' | RecurFrequency,
  referenceDate?: string
): RecurrenceValue {
  if (frequency === 'NONE') return NO_RECURRENCE;

  const ref = parseReference(referenceDate);
  const day = ref.getDate();

  switch (frequency) {
    case 'WEEKLY':
      return { frequency, dayOfWeek: ref.getDay(), dayOfMonth: null, dayOfMonth2: null };
    case 'MONTHLY':
      return { frequency, dayOfWeek: null, dayOfMonth: day, dayOfMonth2: null };
    case 'BIWEEKLY': {
      // Pair the entry day with its kinsenas counterpart (±15), kept in 1–31
      const second = day <= 15 ? Math.min(day + 15, 31) : Math.max(day - 15, 1);
      return {
        frequency,
        dayOfWeek: null,
        dayOfMonth: Math.min(day, second),
        dayOfMonth2: Math.max(day, second),
      };
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

interface RecurrenceFieldsProps {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
  /** Entry date (YYYY-MM-DD) used to seed day defaults on frequency switch */
  referenceDate?: string;
  /** Unique element-id prefix — required when two pickers mount on one page */
  idPrefix?: string;
}

/**
 * "Repeat" picker: frequency select plus the day fields that frequency needs.
 * Day-of-month allows 1–31 — short months clamp to their last day server-side,
 * so a day-30 salary fires on Feb 28/29.
 *
 * Controlled component; validate with recurrenceIsValid before submitting.
 */
export function RecurrenceFields({
  value,
  onChange,
  referenceDate,
  idPrefix = 'recurrence',
}: RecurrenceFieldsProps): React.JSX.Element {
  function handleFrequencyChange(next: string) {
    onChange(defaultsForFrequency(next as 'NONE' | RecurFrequency, referenceDate));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-frequency`}>Repeat</Label>
        <Select value={value.frequency} onValueChange={handleFrequencyChange}>
          <SelectTrigger id={`${idPrefix}-frequency`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Does not repeat</SelectItem>
            <SelectItem value="WEEKLY">Weekly</SelectItem>
            <SelectItem value="BIWEEKLY">Bi-Weekly</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.frequency === 'WEEKLY' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-day-of-week`}>Day of week</Label>
          <Select
            value={value.dayOfWeek !== null ? String(value.dayOfWeek) : undefined}
            onValueChange={(v) => onChange({ ...value, dayOfWeek: Number(v) })}
          >
            <SelectTrigger id={`${idPrefix}-day-of-week`} className="w-full">
              <SelectValue placeholder="Pick a day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map(({ value: day, label }) => (
                <SelectItem key={day} value={String(day)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {value.frequency === 'BIWEEKLY' ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-day-of-month-1`}>First day of month</Label>
            <Select
              value={value.dayOfMonth !== null ? String(value.dayOfMonth) : undefined}
              onValueChange={(v) => onChange({ ...value, dayOfMonth: Number(v) })}
            >
              <SelectTrigger id={`${idPrefix}-day-of-month-1`} className="w-full">
                <SelectValue placeholder="Pick a day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_MONTH.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {formatOrdinal(day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-day-of-month-2`}>Second day of month</Label>
            <Select
              value={value.dayOfMonth2 !== null ? String(value.dayOfMonth2) : undefined}
              onValueChange={(v) => onChange({ ...value, dayOfMonth2: Number(v) })}
            >
              <SelectTrigger id={`${idPrefix}-day-of-month-2`} className="w-full">
                <SelectValue placeholder="Pick a day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_MONTH.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {formatOrdinal(day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value.dayOfMonth !== null && value.dayOfMonth === value.dayOfMonth2 ? (
              <p className="text-xs text-expense">Pick two different days.</p>
            ) : (
              <p className="text-xs text-ink-faint">Repeats on both days each month.</p>
            )}
          </div>
        </div>
      ) : null}

      {value.frequency === 'MONTHLY' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-day-of-month`}>Day of month</Label>
          <Select
            value={value.dayOfMonth !== null ? String(value.dayOfMonth) : undefined}
            onValueChange={(v) => onChange({ ...value, dayOfMonth: Number(v) })}
          >
            <SelectTrigger id={`${idPrefix}-day-of-month`} className="w-full">
              <SelectValue placeholder="Pick a day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_MONTH.map((day) => (
                <SelectItem key={day} value={String(day)}>
                  {formatOrdinal(day)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-ink-faint">
            Repeats on this day each month. On shorter months it falls on the last day.
          </p>
        </div>
      ) : null}
    </div>
  );
}
