import { z } from 'zod';

/** Schema for creating an income record. Amount arrives as integer cents from the web layer. */
export const createIncomeSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().int().positive(),
  description: z.string().max(500).optional(),
  incomeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moneyStatus: z.enum(['RECEIVED', 'PENDING']),
  expectedReleaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  profitFirstAllocated: z.boolean().default(true),
});

/** Schema for partial updates — all fields optional. */
export const updateIncomeSchema = createIncomeSchema.partial();

/**
 * Schema for marking income as received (never touches profitFirstAllocated — T-02-08).
 * amount (integer cents) is optional: required by the service when the stored
 * amount is 0 (recurring "amount set on receive" incomes).
 */
export const receiveIncomeSchema = z.object({
  receivedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  amount: z.number().int().positive().optional(),
});

/** Schema for creating an income category. Does NOT expose system — seeder controls that field. */
export const createIncomeCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

/** Schema for renaming an income category. */
export const updateIncomeCategorySchema = createIncomeCategorySchema;

/** Schema for list/filter query params. */
export const incomeQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  moneyStatus: z.enum(['RECEIVED', 'PENDING']).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
