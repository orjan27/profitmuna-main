/**
 * Fixed payment methods for expense recording (D-09).
 * Stored as text in the database; Zod validates against these values at the API boundary.
 * Use `as const` for literal type inference across the app.
 */
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'maya', label: 'Maya' },
  { value: 'check', label: 'Check' },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];

/**
 * Canonical 8-value Profit First color palette.
 *
 * CROSS-PLAN SYNC: apps/api/src/schemas/profit-first.ts (Plan 02) duplicates
 * this exact list for Zod z.enum color validation. The two copies are
 * intentionally separate (packages/db does not export the palette). If one
 * changes, the other MUST change in the same commit.
 *
 * Order matters — the first four map to the D-03 seed defaults (Profit,
 * Owner Pay, Tax, Operating Expenses).
 */
export const PF_DEFAULT_COLORS = [
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;

export type PfDefaultColor = (typeof PF_DEFAULT_COLORS)[number];
