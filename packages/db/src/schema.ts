import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Phase 7: ADMIN unlocks user management and manual cron triggers
  role: text('role', { enum: ['ADMIN', 'USER'] })
    .notNull()
    .default('USER'),
  // Nullable — Google-only users have no password
  passwordHash: text('password_hash'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  // Nullable ISO string — set when the verification link is consumed
  verifiedAt: text('verified_at'),
  // Nullable — set when a Google identity is linked
  googleId: text('google_id').unique(),
  // Phase 6: Settings columns — inserted before createdAt
  // ISO 4217 currency code; default PHP (₱) preserves all existing call sites (SET-01)
  displayCurrency: text('display_currency').notNull().default('PHP'),
  // Reminders off by default until explicitly configured (D-02 recommendation)
  reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(false),
  reminderFrequency: text('reminder_frequency', {
    enum: ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'],
  }),
  // 0–6 (Sun–Sat); null if not WEEKLY
  reminderDayOfWeek: integer('reminder_day_of_week'),
  // 1–28; null if not MONTHLY/BIWEEKLY (capped at 28 to avoid day-31 short-month pitfall)
  reminderDayOfMonth: integer('reminder_day_of_month'),
  // 1–28; second reminder day for BIWEEKLY (twice a month); null otherwise
  reminderDayOfMonth2: integer('reminder_day_of_month_2'),
  // 0–23 Manila time; null if reminders disabled
  reminderHour: integer('reminder_hour'),
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
    // Default true: Profit Muna allocation applied by default (D-14)
    profitMunaAllocated: integer('profit_first_allocated', { mode: 'boolean' })
      .notNull()
      .default(true),
    // Direct wallet top-up: non-null = income added straight to this wallet (PF off,
    // RECEIVED), counted in that wallet's balance/activity and excluded from
    // category-mapping aggregation. Lazy arrow ref (wallets declared later). No cascade.
    walletId: integer('wallet_id').references(() => wallets.id),
    // Denormalized wallet name so soft-deleted wallet names render without a join.
    walletName: text('wallet_name'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Phase 6: dedup guard — set once when PENDING_INCOME_DUE notification fires (D-07)
    pendingDueNotifiedAt: text('pending_due_notified_at'),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('incomes_user_status_idx').on(t.userId, t.moneyStatus),
    index('incomes_user_date_idx').on(t.userId, t.incomeDate),
    index('incomes_user_status_pf_idx').on(t.userId, t.moneyStatus, t.profitMunaAllocated),
    index('incomes_user_category_idx').on(t.userId, t.categoryId),
    index('incomes_user_wallet_idx').on(t.userId, t.walletId),
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

// ─── Phase 3: Profit Muna Allocation tables ──────────────────────────────────

export const profitMunaAccounts = sqliteTable(
  'profit_first_accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** Basis points (0–10000). 500 = 5.00% */
    targetPercentage: integer('target_percentage').notNull(),
    /** Hex color from PM_DEFAULT_COLORS palette */
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    accountType: text('account_type', {
      enum: ['PROFIT', 'OWNERS_PAY', 'TAX', 'OPEX', 'CUSTOM'],
    })
      .notNull()
      .default('CUSTOM'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('pfa_user_name_unique').on(table.userId, table.name)]
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
    // Wallet this expense is paid from (required for new/edited; legacy rows NULL).
    // No cascade — lazy arrow ref is fine even though expenses is declared before wallets.
    walletId: integer('wallet_id').references(() => wallets.id),
    // Denormalized wallet name so soft-deleted wallet names render without a join.
    walletName: text('wallet_name'),
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
    index('expenses_user_wallet_idx').on(t.userId, t.walletId),
  ]
);

// ─── Phase 4: Wallet tables ───────────────────────────────────────────────────

export const wallets = sqliteTable(
  'wallets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Nullable — non-null = PM wallet (auto-funded by its allocation); null = standalone.
    // Sole PM discriminator; no cascade so delete-guard can block (D-01)
    profitMunaAccountId: integer('profit_first_account_id').references(() => profitMunaAccounts.id),
    // Undeletable per-user "Default" wallet flag
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    // Soft delete: null = active; ISO string = soft-deleted
    deletedAt: text('deleted_at'),
    // Hex color string (e.g. #RRGGBB)
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [
    index('wallets_user_idx').on(table.userId),
    // Enforces one wallet per PM account per user (D-01 of WAL-01)
    uniqueIndex('wallets_user_pf_account_unique').on(table.userId, table.profitMunaAccountId),
  ]
);

export const walletIncomeCategoryMappings = sqliteTable(
  'wallet_income_category_mappings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    incomeCategoryId: integer('income_category_id')
      .notNull()
      .references(() => incomeCategories.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [
    // One wallet per income category across all user's wallets (WAL-02)
    uniqueIndex('wicm_income_category_unique').on(table.incomeCategoryId),
    index('wicm_user_idx').on(table.userId),
    index('wicm_wallet_idx').on(table.walletId),
  ]
);

export const walletTransactions = sqliteTable(
  'wallet_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type', { enum: ['DEPOSIT', 'WITHDRAWAL'] }).notNull(),
    // Amount stored as integer cents, always positive (D-08)
    amount: integer('amount').notNull(),
    description: text('description'),
    transactionDate: text('transaction_date').notNull(),
    // Soft delete: null = active; ISO string = soft-deleted (D-09)
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [
    index('wt_user_wallet_idx').on(table.userId, table.walletId),
    index('wt_wallet_date_idx').on(table.walletId, table.transactionDate),
  ]
);

// ─── Phase 6: Notifications ───────────────────────────────────────────────────

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['INCOME_REMINDER', 'PENDING_INCOME_DUE', 'RECURRING_EXPENSE_RECORDED'],
    }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    index('notif_user_read_created_idx').on(table.userId, table.read, table.createdAt),
    index('notif_user_read_idx').on(table.userId, table.read),
  ]
);

// ─── Phase 7: Recurring income & expense templates ───────────────────────────
//
// Templates the hourly cron reads to auto-generate income/expense rows on
// their due day (Manila time). Day fields follow the users.reminder* pattern:
// only the columns the frequency needs are non-null.

export const recurringIncomes = sqliteTable(
  'recurring_incomes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => incomeCategories.id),
    // Denormalized category name for cascade-rename consistency (D-13)
    categoryName: text('category_name').notNull(),
    // Nullable: an estimate, or null = "amount set on receive" — the generated
    // PENDING income gets amount 0 and receive requires the actual amount
    amount: integer('amount'),
    description: text('description'),
    frequency: text('frequency', { enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] }).notNull(),
    // 0–6 (Sun–Sat); null unless WEEKLY
    dayOfWeek: integer('day_of_week'),
    // 1–31 (clamped to last day of short months at generation); null unless MONTHLY/BIWEEKLY
    dayOfMonth: integer('day_of_month'),
    // 1–31; second day for BIWEEKLY; null otherwise
    dayOfMonth2: integer('day_of_month_2'),
    profitMunaAllocated: integer('profit_first_allocated', { mode: 'boolean' })
      .notNull()
      .default(true),
    // Pause/resume without losing the schedule
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    // YYYY-MM-DD dedup guard — set when the cron generates for that date; also
    // seeded to the entry date when created alongside a recorded entry
    lastGeneratedDate: text('last_generated_date'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('recurring_incomes_user_idx').on(t.userId),
    // Cron scans active templates across all users
    index('recurring_incomes_active_idx').on(t.active),
  ]
);

export const recurringExpenses = sqliteTable(
  'recurring_expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => expenseCategories.id),
    // Denormalized category name for cascade-rename consistency (D-13)
    categoryName: text('category_name').notNull(),
    // Required: auto-record needs an exact amount (integer cents, D-08)
    amount: integer('amount').notNull(),
    description: text('description'),
    // Wallet the generated expense is paid from; re-validated at generation
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id),
    walletName: text('wallet_name'),
    frequency: text('frequency', { enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] }).notNull(),
    dayOfWeek: integer('day_of_week'),
    dayOfMonth: integer('day_of_month'),
    dayOfMonth2: integer('day_of_month_2'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    lastGeneratedDate: text('last_generated_date'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('recurring_expenses_user_idx').on(t.userId),
    index('recurring_expenses_active_idx').on(t.active),
  ]
);

/**
 * One row per cron job, overwritten on every run — powers the Settings
 * "Scheduled Jobs" last-run display. Deliberately NOT a history table: the
 * hourly cron would grow it by ~8.7k rows/year for no UI benefit.
 */
export const cronRuns = sqliteTable('cron_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Job identifier — currently only 'cron' (the hourly worker)
  job: text('job').notNull().unique(),
  ranAt: text('ran_at').notNull(),
  trigger: text('trigger', { enum: ['SCHEDULED', 'MANUAL'] }).notNull(),
  generatedIncomes: integer('generated_incomes').notNull().default(0),
  generatedExpenses: integer('generated_expenses').notNull().default(0),
  pendingDueNotifications: integer('pending_due_notifications').notNull().default(0),
  reminderEmails: integer('reminder_emails').notNull().default(0),
});
