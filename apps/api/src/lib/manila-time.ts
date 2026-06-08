/**
 * Manila-time bucketing helper — dependency-free UTC+8 offset.
 *
 * Asia/Manila is always UTC+8 with no DST (IANA tz database; Manila has not
 * observed DST since 1990). A simple offset shift is correct-by-construction
 * and avoids adding @date-fns/tz to apps/api.
 *
 * DO NOT import @date-fns/tz or date-fns here — those packages are pinned
 * in apps/web only, not in apps/api (CLAUDE.md: no new deps without approval).
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface ManilaParts {
  /** Manila local hour (0–23) */
  hour: number;
  /** Manila local day of week (0 = Sunday, 6 = Saturday) */
  dayOfWeek: number;
  /** Manila local day of month (1–31) */
  dayOfMonth: number;
  /** Manila local date string in 'YYYY-MM-DD' format */
  dateStr: string;
}

/**
 * Converts a UTC Date to its Manila time components by adding the fixed UTC+8 offset
 * and reading UTC getters on the shifted Date (avoiding any timezone API).
 *
 * @param now  The UTC instant to convert (typically `new Date()`)
 * @returns    Manila hour, dayOfWeek, dayOfMonth, and dateStr
 *
 * @example
 * // 2026-06-06T01:00:00Z → 09:00 Manila on 2026-06-06
 * getManilaParts(new Date('2026-06-06T01:00:00Z'))
 * // → { hour: 9, dayOfWeek: 6, dayOfMonth: 6, dateStr: '2026-06-06' }
 */
export function getManilaParts(now: Date): ManilaParts {
  const m = new Date(now.getTime() + MANILA_OFFSET_MS);
  const year = m.getUTCFullYear();
  const month0 = m.getUTCMonth(); // 0-based
  const day = m.getUTCDate();
  return {
    hour: m.getUTCHours(),
    dayOfWeek: m.getUTCDay(),
    dayOfMonth: day,
    dateStr: `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/**
 * Returns the last day of a given month (1-based result, 0-based month input).
 * Used for the day-31 monthly-reminder clamp (Pitfall 6): if a user stored
 * reminderDayOfMonth = 31, fire on the last day of shorter months.
 *
 * @param year   Full year (e.g. 2026)
 * @param month0 0-based month (0 = January, 11 = December)
 * @returns      Last day of that month (28–31)
 */
export function lastDayOfMonth(year: number, month0: number): number {
  // Date(year, month1, 0) gives the last day of the previous month (i.e. month0)
  return new Date(year, month0 + 1, 0).getDate();
}

/** Recurrence frequency shared by reminders and recurring income/expense templates. */
export type RecurFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface ScheduleSpec {
  frequency: RecurFrequency;
  /** 0–6 (Sun–Sat); required for WEEKLY */
  dayOfWeek: number | null;
  /** 1–31; required for MONTHLY and BIWEEKLY */
  dayOfMonth: number | null;
  /** 1–31; second day for BIWEEKLY */
  dayOfMonth2: number | null;
}

/**
 * Returns true when the given schedule fires on the Manila day in `parts`.
 *
 * Day-of-month values above the current month's length clamp to its last day
 * (Pitfall 6: a day-30 schedule fires on Feb 28/29). Pure day matching only —
 * callers own any enabled/hour gating.
 *
 * @param spec  The frequency + day fields (unused days may be null)
 * @param parts Manila time parts for "today"
 */
export function scheduleMatchesToday(spec: ScheduleSpec, parts: ManilaParts): boolean {
  const clampToMonth = (day: number): number => {
    const manilaDate = new Date(parts.dateStr + 'T00:00:00Z');
    return Math.min(day, lastDayOfMonth(manilaDate.getUTCFullYear(), manilaDate.getUTCMonth()));
  };

  switch (spec.frequency) {
    case 'WEEKLY':
      return spec.dayOfWeek === parts.dayOfWeek;

    case 'BIWEEKLY': {
      // Twice a month: due when either configured day matches today
      if (spec.dayOfMonth === null || spec.dayOfMonth2 === null) return false;
      return (
        clampToMonth(spec.dayOfMonth) === parts.dayOfMonth ||
        clampToMonth(spec.dayOfMonth2) === parts.dayOfMonth
      );
    }

    case 'MONTHLY': {
      if (spec.dayOfMonth === null) return false;
      return clampToMonth(spec.dayOfMonth) === parts.dayOfMonth;
    }

    default:
      return false;
  }
}
