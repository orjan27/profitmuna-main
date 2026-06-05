import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
