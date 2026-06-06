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
