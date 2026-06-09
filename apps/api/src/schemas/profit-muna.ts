import { z } from 'zod';

/**
 * Canonical 8-value Profit Muna color palette — Zod validation source.
 *
 * CROSS-PLAN SYNC: apps/web/src/lib/constants.ts (Plan 01) is the UI swatch source.
 * These two copies are intentionally duplicated (packages/db does not export the
 * palette). If one copy changes, the other MUST change in the same commit.
 *
 * Order matches D-03 seed defaults (Profit, Owner Pay, Tax, OPEX) then extra swatches.
 */
const PM_DEFAULT_COLORS = [
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;

/**
 * Schema for creating a new custom Profit Muna allocation account.
 * targetPercentage is in basis points (0–10000); 500 = 5.00%.
 * The percent→bp conversion happens in the web server action before sending.
 */
export const createAccountSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  /** Basis points (0–10000). 500 = 5.00% */
  targetPercentage: z.number().int().min(0).max(10000),
  color: z.enum(PM_DEFAULT_COLORS),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Schema for partially updating a Profit Muna account.
 * All fields are optional; at least one must differ from the current value.
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  /** Basis points (0–10000). */
  targetPercentage: z.number().int().min(0).max(10000).optional(),
  color: z.enum(PM_DEFAULT_COLORS).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Schema for bulk-updating targetPercentage across all accounts.
 * The service validates that the submitted set sums to exactly 10000 bp.
 */
export const updatePercentagesSchema = z.object({
  accounts: z
    .array(
      z.object({
        id: z.number().int().positive(),
        /** Basis points (0–10000). */
        targetPercentage: z.number().int().min(0).max(10000),
      })
    )
    .min(1),
});

/**
 * Schema for the allocation summary query string.
 * categoryIds is a comma-separated string; parsing to number[] happens in the route/service.
 */
export const summaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  /** Comma-separated category IDs, e.g. "1,2,3" */
  categoryIds: z.string().optional(),
});
