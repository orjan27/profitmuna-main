import { z } from 'zod';

/** Schema for creating an expense. amount is integer cents from the web layer. */
export const createExpenseSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().int().positive(),
  description: z.string().max(500).optional().nullable(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expenseDate must be YYYY-MM-DD'),
  // Wallet this expense is paid from — required for new expenses ("Paid with").
  walletId: z.number().int().positive(),
});

/** Partial schema for updating an expense (all fields optional). */
export const updateExpenseSchema = createExpenseSchema.partial();

/** Schema for creating an expense category. Does NOT expose system — seeder controls that field. */
export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

/** Schema for renaming an expense category. */
export const updateExpenseCategorySchema = createExpenseCategorySchema;

/** Query schema for listing expenses with pagination and optional date range. */
export const expenseQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
