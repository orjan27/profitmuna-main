import { createDb } from '@app/db';
import { profitFirstAccounts } from '@app/db/schema';

/**
 * Seeds the four canonical Profit First allocation accounts for a newly created user.
 *
 * Default values (D-03):
 * - Profit: 5% (500 bp), #10b981, sort 0
 * - Owner Pay: 50% (5000 bp), #8b5cf6, sort 1
 * - Tax: 15% (1500 bp), #f59e0b, sort 2
 * - Operating Expenses: 30% (3000 bp), #f43f5e, sort 3
 *
 * The unique index on (userId, name) makes this safe to call idempotently —
 * a second call for the same userId will throw a constraint error, which is
 * the desired behaviour (prevents duplicates for returning users).
 *
 * Call ONLY from:
 * 1. register() — after user insert, before issueVerifyToken
 * 2. upsertGoogleUser() branch 3 (brand-new user) — never branches 1 or 2
 *
 * @param db  Drizzle instance (pass createDb(c.env.DB) per request)
 * @param userId  Freshly inserted user.id — never client-supplied
 */
export async function seedProfitFirstAccounts(
  db: ReturnType<typeof createDb>,
  userId: number
): Promise<void> {
  const defaults = [
    {
      name: 'Profit',
      targetPercentage: 500,
      color: '#10b981',
      sortOrder: 0,
      accountType: 'PROFIT' as const,
    },
    {
      name: 'Owner Pay',
      targetPercentage: 5000,
      color: '#8b5cf6',
      sortOrder: 1,
      accountType: 'OWNERS_PAY' as const,
    },
    {
      name: 'Tax',
      targetPercentage: 1500,
      color: '#f59e0b',
      sortOrder: 2,
      accountType: 'TAX' as const,
    },
    {
      name: 'Operating Expenses',
      targetPercentage: 3000,
      color: '#f43f5e',
      sortOrder: 3,
      accountType: 'OPEX' as const,
    },
  ] as const;

  await db.insert(profitFirstAccounts).values(defaults.map((d) => ({ ...d, userId })));
}
