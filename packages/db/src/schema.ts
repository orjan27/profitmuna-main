import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Nullable — Google-only users have no password
  passwordHash: text('password_hash'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  // Nullable ISO string — set when the verification link is consumed
  verifiedAt: text('verified_at'),
  // Nullable — set when a Google identity is linked
  googleId: text('google_id').unique(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  // null = active; ISO string = revoked (reuse of a revoked token signals theft)
  revokedAt: text('revoked_at'),
  // Rotation lineage — id of the token this one replaced
  rotatedFrom: integer('rotated_from'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const authTokens = sqliteTable('auth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  purpose: text('purpose', { enum: ['verify_email', 'reset_password'] }).notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const loginAttempts = sqliteTable('login_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  count: integer('count').notNull().default(0),
  lastAttemptAt: text('last_attempt_at').notNull(),
  // Nullable ISO string — login blocked until this time
  lockedUntil: text('locked_until'),
});

// ─── Phase 2: Income & Expense tables ────────────────────────────────────────

export const incomeCategories = sqliteTable(
  'income_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    // system = true means this is a protected default category (D-01)
    system: integer('system', { mode: 'boolean' }).notNull().default(false),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('ic_user_idx').on(t.userId),
    // Race-safe seeding: unique(userId, name) enables onConflictDoNothing (T-02-03)
    uniqueIndex('ic_user_name_unique').on(t.userId, t.name),
  ]
);

export const incomes = sqliteTable(
  'incomes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => incomeCategories.id),
    // Denormalized category name for cascade-rename consistency (D-13)
    categoryName: text('category_name').notNull(),
    // Amount stored as integer cents to avoid floating-point errors (D-08)
    amount: integer('amount').notNull(),
    description: text('description'),
    incomeDate: text('income_date').notNull(),
    moneyStatus: text('money_status', { enum: ['RECEIVED', 'PENDING'] })
      .notNull()
      .default('PENDING'),
    expectedReleaseDate: text('expected_release_date'),
    receivedDate: text('received_date'),
    // Default true: Profit First allocation applied by default (D-14)
    profitFirstAllocated: integer('profit_first_allocated', { mode: 'boolean' })
      .notNull()
      .default(true),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('incomes_user_status_idx').on(t.userId, t.moneyStatus),
    index('incomes_user_date_idx').on(t.userId, t.incomeDate),
    index('incomes_user_status_pf_idx').on(t.userId, t.moneyStatus, t.profitFirstAllocated),
    index('incomes_user_category_idx').on(t.userId, t.categoryId),
  ]
);

export const expenseCategories = sqliteTable(
  'expense_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    // system = true means this is a protected default category (D-02)
    system: integer('system', { mode: 'boolean' }).notNull().default(false),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('ec_user_idx').on(t.userId),
    // Race-safe seeding: unique(userId, name) enables onConflictDoNothing (T-02-03)
    uniqueIndex('ec_user_name_unique').on(t.userId, t.name),
  ]
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => expenseCategories.id),
    // Denormalized category name for cascade-rename consistency (D-13)
    categoryName: text('category_name').notNull(),
    // Amount stored as integer cents to avoid floating-point errors (D-08)
    amount: integer('amount').notNull(),
    description: text('description'),
    expenseDate: text('expense_date').notNull(),
    // Nullable text — enum enforced at Zod layer, not DB (D-10)
    paymentMethod: text('payment_method'),
    // Soft delete: set deletedAt to ISO string; null = active (EXP-04)
    deletedAt: text('deleted_at'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('expenses_user_idx').on(t.userId),
    index('expenses_user_date_idx').on(t.userId, t.expenseDate),
    index('expenses_user_category_idx').on(t.userId, t.categoryId),
  ]
);
