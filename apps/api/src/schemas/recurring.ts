import { z } from 'zod';

// ─── Shared recurrence fields ─────────────────────────────────────────────────

/**
 * Day fields shared by recurring income and expense templates.
 * Days of month allow 1–31; short months clamp at generation time
 * (scheduleMatchesToday), so a day-30 salary fires on Feb 28/29.
 */
const recurrenceFields = {
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  dayOfMonth2: z.number().int().min(1).max(31).optional().nullable(),
};

interface RecurrenceShape {
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dayOfMonth2?: number | null;
}

/**
 * Cross-field invariant: each frequency requires exactly its own day fields.
 * - WEEKLY → dayOfWeek
 * - BIWEEKLY → dayOfMonth + dayOfMonth2, distinct
 * - MONTHLY → dayOfMonth
 */
function refineRecurrence(value: RecurrenceShape, ctx: z.RefinementCtx): void {
  switch (value.frequency) {
    case 'WEEKLY':
      if (value.dayOfWeek == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['dayOfWeek'],
          message: 'dayOfWeek is required for WEEKLY',
        });
      }
      break;
    case 'BIWEEKLY':
      if (value.dayOfMonth == null || value.dayOfMonth2 == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['dayOfMonth2'],
          message: 'dayOfMonth and dayOfMonth2 are required for BIWEEKLY',
        });
      } else if (value.dayOfMonth === value.dayOfMonth2) {
        ctx.addIssue({
          code: 'custom',
          path: ['dayOfMonth2'],
          message: 'BIWEEKLY days must be distinct',
        });
      }
      break;
    case 'MONTHLY':
      if (value.dayOfMonth == null) {
        ctx.addIssue({
          code: 'custom',
          path: ['dayOfMonth'],
          message: 'dayOfMonth is required for MONTHLY',
        });
      }
      break;
  }
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ─── Recurring income ─────────────────────────────────────────────────────────

/**
 * Schema for creating a recurring income template. Amount is nullable — null
 * means "amount set on receive": the generated PENDING income gets amount 0
 * and receiving it requires the actual amount.
 * lastGeneratedDate lets the web layer seed the dedup guard to the entry date
 * when a template is created alongside a recorded entry.
 */
export const createRecurringIncomeSchema = z
  .object({
    categoryId: z.number().int().positive(),
    amount: z.number().int().positive().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    profitFirstAllocated: z.boolean().default(true),
    lastGeneratedDate: dateString.optional().nullable(),
    ...recurrenceFields,
  })
  .superRefine(refineRecurrence);

/**
 * Schema for updating a recurring income template. frequency stays required so
 * the day-field invariant is always checkable; active enables pause/resume.
 */
export const updateRecurringIncomeSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    amount: z.number().int().positive().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    profitFirstAllocated: z.boolean().optional(),
    active: z.boolean().optional(),
    ...recurrenceFields,
  })
  .superRefine(refineRecurrence);

// ─── Recurring expense ────────────────────────────────────────────────────────

/** Schema for creating a recurring expense template. Amount required — auto-record needs it. */
export const createRecurringExpenseSchema = z
  .object({
    categoryId: z.number().int().positive(),
    amount: z.number().int().positive(),
    description: z.string().max(500).optional().nullable(),
    walletId: z.number().int().positive(),
    lastGeneratedDate: dateString.optional().nullable(),
    ...recurrenceFields,
  })
  .superRefine(refineRecurrence);

/** Schema for updating a recurring expense template. */
export const updateRecurringExpenseSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    amount: z.number().int().positive().optional(),
    description: z.string().max(500).optional().nullable(),
    walletId: z.number().int().positive().optional(),
    active: z.boolean().optional(),
    ...recurrenceFields,
  })
  .superRefine(refineRecurrence);
