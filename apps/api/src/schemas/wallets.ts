import { z } from 'zod';

// Named exports only — matches auth.ts convention

export const expenseModeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({ kind: z.literal('ALL') }),
  z.object({ kind: z.literal('CATEGORIES'), ids: z.array(z.number().int().positive()).min(1) }),
]);

// Base object without refine — needed so .partial() works on update (Zod v4 disallows .partial() on refined schemas)
const walletBaseSchema = z.object({
  name: z.string().min(1).max(80),
  sourceType: z.enum(['PROFIT_FIRST', 'BLANK']),
  profitFirstAccountId: z.number().int().positive().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  sortOrder: z.number().int().optional(),
  incomeCategoryIds: z.array(z.number().int().positive()).optional(),
  expenseMode: expenseModeSchema.optional(),
});

export const createWalletSchema = walletBaseSchema.refine(
  (d) =>
    d.sourceType !== 'PROFIT_FIRST' ||
    (d.profitFirstAccountId !== undefined && d.profitFirstAccountId !== null),
  {
    message: 'profitFirstAccountId is required when sourceType is PROFIT_FIRST',
    path: ['profitFirstAccountId'],
  }
);

// Update schema: all fields optional; no PF-account refine needed (partial edits are valid)
export const updateWalletSchema = walletBaseSchema.partial();

export const walletTransactionSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateWalletTransactionSchema = walletTransactionSchema.partial();

export const walletTransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const walletIdParamSchema = z.object({
  walletId: z.coerce.number().int().positive(),
});

export const txIdParamSchema = z.object({
  walletId: z.coerce.number().int().positive(),
  txId: z.coerce.number().int().positive(),
});
