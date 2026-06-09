import { describe, it, expect } from 'vitest';

import { getManilaParts, nextOccurrence, type ScheduleSpec } from '@/lib/manila-time';

// 2026-06-10 is a Wednesday (dayOfWeek 3) in Manila.
const TODAY = getManilaParts(new Date('2026-06-10T01:00:00.000Z'));

function spec(partial: Partial<ScheduleSpec> & Pick<ScheduleSpec, 'frequency'>): ScheduleSpec {
  return { dayOfWeek: null, dayOfMonth: null, dayOfMonth2: null, ...partial };
}

describe('nextOccurrence', () => {
  describe('WEEKLY', () => {
    it('returns the next matching weekday later this week', () => {
      // Friday (5) is two days after Wednesday (3)
      expect(nextOccurrence(spec({ frequency: 'WEEKLY', dayOfWeek: 5 }), TODAY)).toBe('2026-06-12');
    });

    it('counts today when the weekday matches', () => {
      expect(nextOccurrence(spec({ frequency: 'WEEKLY', dayOfWeek: 3 }), TODAY)).toBe('2026-06-10');
    });

    it('wraps to next week when the weekday has already passed', () => {
      // Tuesday (2) is the day before today → next Tuesday
      expect(nextOccurrence(spec({ frequency: 'WEEKLY', dayOfWeek: 2 }), TODAY)).toBe('2026-06-16');
    });

    it('returns null when dayOfWeek is missing', () => {
      expect(nextOccurrence(spec({ frequency: 'WEEKLY' }), TODAY)).toBeNull();
    });
  });

  describe('MONTHLY', () => {
    it('returns this month when the day is still ahead', () => {
      expect(nextOccurrence(spec({ frequency: 'MONTHLY', dayOfMonth: 15 }), TODAY)).toBe(
        '2026-06-15'
      );
    });

    it('rolls to next month when the day has passed', () => {
      expect(nextOccurrence(spec({ frequency: 'MONTHLY', dayOfMonth: 5 }), TODAY)).toBe(
        '2026-07-05'
      );
    });

    it('clamps day-31 to the last day of a shorter month', () => {
      const jan = getManilaParts(new Date('2026-01-31T01:00:00.000Z'));
      // From Jan 31, the next day-31 occurrence clamps to Feb 28 (2026 is not a leap year)
      expect(nextOccurrence(spec({ frequency: 'MONTHLY', dayOfMonth: 31 }), jan)).toBe(
        '2026-01-31'
      );
      const feb = getManilaParts(new Date('2026-02-01T01:00:00.000Z'));
      expect(nextOccurrence(spec({ frequency: 'MONTHLY', dayOfMonth: 31 }), feb)).toBe(
        '2026-02-28'
      );
    });
  });

  describe('BIWEEKLY', () => {
    it('returns the nearest of the two configured days', () => {
      expect(
        nextOccurrence(spec({ frequency: 'BIWEEKLY', dayOfMonth: 5, dayOfMonth2: 20 }), TODAY)
      ).toBe('2026-06-20');
    });

    it('rolls to next month when both days have passed', () => {
      expect(
        nextOccurrence(spec({ frequency: 'BIWEEKLY', dayOfMonth: 1, dayOfMonth2: 8 }), TODAY)
      ).toBe('2026-07-01');
    });

    it('returns null when either day is missing', () => {
      expect(nextOccurrence(spec({ frequency: 'BIWEEKLY', dayOfMonth: 5 }), TODAY)).toBeNull();
    });
  });
});
