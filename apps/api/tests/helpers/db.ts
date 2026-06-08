import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';

import { schema } from '@app/db';

import type { Bindings } from '@/types';

type SqliteDb = InstanceType<typeof Database>;

// Raw DDL mirroring packages/db/src/schema.ts — keep in sync with the Drizzle schema.
// Phase 1: auth tables; Phase 2: income/expense tables; Phase 6: notifications + settings.
const DDL = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  google_id TEXT UNIQUE,
  display_currency TEXT NOT NULL DEFAULT 'PHP',
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_frequency TEXT,
  reminder_day_of_week INTEGER,
  reminder_day_of_month INTEGER,
  reminder_day_of_month_2 INTEGER,
  reminder_hour INTEGER,
  created_at TEXT
);
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  rotated_from INTEGER,
  created_at TEXT
);
CREATE TABLE auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT
);
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT NOT NULL,
  locked_until TEXT
);

-- Phase 2: income/expense tables
CREATE TABLE income_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  system INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ic_user_idx ON income_categories (user_id);
CREATE UNIQUE INDEX ic_user_name_unique ON income_categories (user_id, name);

CREATE TABLE incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES income_categories(id),
  category_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  income_date TEXT NOT NULL,
  money_status TEXT NOT NULL DEFAULT 'PENDING',
  expected_release_date TEXT,
  received_date TEXT,
  profit_first_allocated INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pending_due_notified_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX incomes_user_status_idx ON incomes (user_id, money_status);
CREATE INDEX incomes_user_date_idx ON incomes (user_id, income_date);
CREATE INDEX incomes_user_status_pf_idx ON incomes (user_id, money_status, profit_first_allocated);
CREATE INDEX incomes_user_category_idx ON incomes (user_id, category_id);

CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  system INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ec_user_idx ON expense_categories (user_id);
CREATE UNIQUE INDEX ec_user_name_unique ON expense_categories (user_id, name);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  category_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  expense_date TEXT NOT NULL,
  wallet_id INTEGER REFERENCES wallets(id),
  wallet_name TEXT,
  deleted_at TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX expenses_user_idx ON expenses (user_id);
CREATE INDEX expenses_user_date_idx ON expenses (user_id, expense_date);
CREATE INDEX expenses_user_category_idx ON expenses (user_id, category_id);
CREATE INDEX expenses_user_wallet_idx ON expenses (user_id, wallet_id);

-- Phase 3: Profit First Allocation tables
CREATE TABLE profit_first_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_percentage INTEGER NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  account_type TEXT NOT NULL DEFAULT 'CUSTOM',
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX pfa_user_name_unique ON profit_first_accounts (user_id, name);

-- Phase 4: Wallet tables
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profit_first_account_id INTEGER REFERENCES profit_first_accounts(id),
  is_default INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX wallets_user_idx ON wallets (user_id);
CREATE UNIQUE INDEX wallets_user_pf_account_unique ON wallets (user_id, profit_first_account_id);

CREATE TABLE wallet_income_category_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  income_category_id INTEGER NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX wicm_income_category_unique ON wallet_income_category_mappings (income_category_id);
CREATE INDEX wicm_user_idx ON wallet_income_category_mappings (user_id);
CREATE INDEX wicm_wallet_idx ON wallet_income_category_mappings (wallet_id);

CREATE TABLE wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  transaction_date TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX wt_user_wallet_idx ON wallet_transactions (user_id, wallet_id);
CREATE INDEX wt_wallet_date_idx ON wallet_transactions (wallet_id, transaction_date);

-- Phase 6: Notifications table
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);
CREATE INDEX notif_user_read_created_idx ON notifications (user_id, read, created_at);
CREATE INDEX notif_user_read_idx ON notifications (user_id, read);

-- Phase 7: Recurring income/expense templates
CREATE TABLE recurring_incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES income_categories(id),
  category_name TEXT NOT NULL,
  amount INTEGER,
  description TEXT,
  frequency TEXT NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  day_of_month_2 INTEGER,
  profit_first_allocated INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  last_generated_date TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX recurring_incomes_user_idx ON recurring_incomes (user_id);
CREATE INDEX recurring_incomes_active_idx ON recurring_incomes (active);

CREATE TABLE recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  category_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id),
  wallet_name TEXT,
  frequency TEXT NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  day_of_month_2 INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  last_generated_date TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX recurring_expenses_user_idx ON recurring_expenses (user_id);
CREATE INDEX recurring_expenses_active_idx ON recurring_expenses (active);

-- Phase 7: cron run tracking (one row per job, overwritten each run)
CREATE TABLE cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL UNIQUE,
  ran_at TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  generated_incomes INTEGER NOT NULL DEFAULT 0,
  generated_expenses INTEGER NOT NULL DEFAULT 0,
  pending_due_notifications INTEGER NOT NULL DEFAULT 0,
  reminder_emails INTEGER NOT NULL DEFAULT 0
);
`;

function makeStatement(sqlite: SqliteDb, query: string, params: unknown[]) {
  return {
    bind(...args: unknown[]) {
      return makeStatement(sqlite, query, args);
    },
    async all() {
      const stmt = sqlite.prepare(query);
      if (!stmt.reader) {
        const info = stmt.run(...(params as never[]));
        return {
          results: [],
          success: true,
          meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
        };
      }
      const results = stmt.all(...(params as never[]));
      return { results, success: true, meta: {} };
    },
    async raw(options?: { columnNames?: boolean }) {
      const stmt = sqlite.prepare(query);
      if (!stmt.reader) {
        stmt.run(...(params as never[]));
        return [];
      }
      stmt.raw(true);
      const rows = stmt.all(...(params as never[])) as unknown[][];
      if (options?.columnNames) {
        return [stmt.columns().map((c) => c.name), ...rows];
      }
      return rows;
    },
    async run() {
      const stmt = sqlite.prepare(query);
      if (stmt.reader) {
        const results = stmt.all(...(params as never[]));
        return { results, success: true, meta: {} };
      }
      const info = stmt.run(...(params as never[]));
      return {
        success: true,
        meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
      };
    },
    async first(column?: string) {
      const stmt = sqlite.prepare(query);
      const row = stmt.get(...(params as never[])) as Record<string, unknown> | undefined;
      if (row === undefined) return null;
      return column ? (row[column] ?? null) : row;
    },
  };
}

/**
 * Wraps an in-memory better-sqlite3 database in the subset of the D1Database
 * interface that drizzle-orm/d1 uses (prepare/bind/all/raw/run/first).
 */
function createD1Shim(sqlite: SqliteDb): D1Database {
  const d1 = {
    prepare(query: string) {
      return makeStatement(sqlite, query, []);
    },
    async batch(statements: ReturnType<typeof makeStatement>[]) {
      const results = [];
      for (const stmt of statements) results.push(await stmt.all());
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    async dump() {
      throw new Error('dump() not supported in test shim');
    },
  };
  return d1 as unknown as D1Database;
}

/**
 * Creates a fresh in-memory test database with the auth schema applied.
 * @returns The D1-compatible binding, a drizzle instance for direct
 *          assertions/seeding, and the raw sqlite handle.
 */
export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  const d1 = createD1Shim(sqlite);
  const db = drizzle(sqlite, { schema });
  // dbD1 is the same drizzle API but backed by the D1 driver (over the shim),
  // so it exposes D1-only primitives like db.batch() that services rely on in
  // production. Use this when constructing a service that calls db.batch().
  const dbD1 = drizzleD1(d1, { schema });
  return { d1, db, dbD1, sqlite };
}

/**
 * Seeds a user row directly (bypasses the API).
 */
export function seedUser(
  db: ReturnType<typeof createTestDb>['db'],
  input: {
    email: string;
    name: string;
    passwordHash?: string | null;
    emailVerified?: boolean;
    googleId?: string | null;
  }
) {
  const [row] = db
    .insert(schema.users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash ?? null,
      emailVerified: input.emailVerified ?? false,
      googleId: input.googleId ?? null,
    })
    .returning()
    .all();
  return row;
}

/**
 * Builds a Bindings object with test secrets and the given (or a fresh) test DB.
 */
export function mockEnv(overrides: Partial<Bindings> = {}, d1?: D1Database): Bindings {
  return {
    DB: d1 ?? createTestDb().d1,
    JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret',
    RESEND_API_KEY: 'test-resend-key',
    RESEND_FROM_EMAIL: 'test@profitmuna.test',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:8793/api/auth/google/callback',
    APP_BASE_URL: 'http://localhost:3006',
    NODE_ENV: 'test',
    ...overrides,
  };
}
