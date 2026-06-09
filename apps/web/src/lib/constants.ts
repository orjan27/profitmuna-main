/**
 * Canonical 8-value Profit Muna color palette.
 *
 * CROSS-PLAN SYNC: apps/api/src/schemas/profit-muna.ts (Plan 02) duplicates
 * this exact list for Zod z.enum color validation. The two copies are
 * intentionally separate (packages/db does not export the palette). If one
 * changes, the other MUST change in the same commit.
 *
 * Order matters — the first four map to the D-03 seed defaults (Profit,
 * Owner Pay, Tax, Operating Expenses).
 */
export const PM_DEFAULT_COLORS = [
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;

export type PmDefaultColor = (typeof PM_DEFAULT_COLORS)[number];
