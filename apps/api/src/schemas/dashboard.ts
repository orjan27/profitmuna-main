import { z } from 'zod';

/**
 * Schema for the dashboard summary query string.
 *
 * from/to use a strict YYYY-MM-DD regex — the date-injection defense (T-05-02):
 * the values flow into SQL comparisons against incomeDate/expenseDate/
 * transactionDate, so only canonical ISO dates are accepted.
 */
export const dashboardQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  feedPage: z.coerce.number().int().min(0).default(0),
  feedSize: z.coerce.number().int().min(1).max(100).default(20),
});
