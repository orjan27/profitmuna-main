import { format } from 'date-fns';

import { formatOrdinal } from '@/lib/format-date';
import type { RecurrenceSchedule } from '@/types/recurring';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Human-readable schedule line for a recurring template.
 * Examples: "Every Friday", "Every 15th & 30th", "Every 30th of the month".
 */
export function formatScheduleSummary(schedule: RecurrenceSchedule): string {
  switch (schedule.frequency) {
    case 'WEEKLY':
      return schedule.dayOfWeek !== null ? `Every ${WEEKDAY_NAMES[schedule.dayOfWeek]}` : 'Weekly';
    case 'BIWEEKLY':
      return schedule.dayOfMonth !== null && schedule.dayOfMonth2 !== null
        ? `Every ${formatOrdinal(schedule.dayOfMonth)} & ${formatOrdinal(schedule.dayOfMonth2)}`
        : 'Bi-weekly';
    case 'MONTHLY':
      return schedule.dayOfMonth !== null
        ? `Every ${formatOrdinal(schedule.dayOfMonth)} of the month`
        : 'Monthly';
  }
}

/** Last day of the given month (1-based result, 0-based month input). */
function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Clamp a day-of-month into the given month's length (day-31 → Feb 28/29). */
function clampedDate(year: number, month0: number, day: number): Date {
  return new Date(year, month0, Math.min(day, daysInMonth(year, month0)));
}

/**
 * Next date (YYYY-MM-DD) the schedule fires, counting today. Display-only —
 * authoritative generation happens server-side in Manila time; local-time
 * drift of a day around midnight is acceptable for a "next: Jun 30" label.
 */
export function nextDueDate(schedule: RecurrenceSchedule, from: Date = new Date()): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  let next: Date;
  switch (schedule.frequency) {
    case 'WEEKLY': {
      const target = schedule.dayOfWeek ?? 0;
      const ahead = (target - today.getDay() + 7) % 7;
      next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
      break;
    }
    case 'MONTHLY': {
      const day = schedule.dayOfMonth ?? 1;
      const thisMonth = clampedDate(today.getFullYear(), today.getMonth(), day);
      next =
        thisMonth >= today
          ? thisMonth
          : clampedDate(today.getFullYear(), today.getMonth() + 1, day);
      break;
    }
    case 'BIWEEKLY': {
      const days = [schedule.dayOfMonth ?? 1, schedule.dayOfMonth2 ?? 15];
      const candidates = days
        .map((day) => clampedDate(today.getFullYear(), today.getMonth(), day))
        .filter((date) => date >= today)
        .sort((a, b) => a.getTime() - b.getTime());
      next =
        candidates[0] ??
        clampedDate(today.getFullYear(), today.getMonth() + 1, Math.min(days[0], days[1]));
      break;
    }
  }

  return format(next, 'yyyy-MM-dd');
}
