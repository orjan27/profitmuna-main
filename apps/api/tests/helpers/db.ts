import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { schema } from '@app/db';

import type { Bindings } from '@/types';

type SqliteDb = InstanceType<typeof Database>;

// Raw DDL mirroring packages/db/src/schema.ts — keep in sync with the Drizzle schema.
const DDL = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  google_id TEXT UNIQUE,
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
  return { d1, db, sqlite };
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
