import { HTTPException } from 'hono/http-exception';
import { eq, and } from 'drizzle-orm';

import { createDb } from '@app/db';
import {
  users,
  authTokens,
  refreshTokens as refreshTokensTable,
  loginAttempts,
} from '@app/db/schema';

import { hashPassword, verifyPassword } from '@/lib/password';
import { generateSecureToken, sha256Hash } from '@/lib/token';
import { signAccessToken } from '@/lib/jwt';

/** Maximum failed attempts before lockout */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout window in milliseconds (15 minutes) */
const LOCKOUT_MS = 15 * 60 * 1000;
/** Refresh token lifetime in milliseconds (7 days) */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h (D-10)

export type RegisterInput = {
  email: string;
  name: string;
  password: string;
};

export type RegisterResult = {
  verifyUrl: string;
  email: string;
  name: string;
} | null;

/**
 * Issues a fresh verify_email token for the user, replacing any prior one.
 * Stores only the sha256 hash; the raw token rides in the email link (D-09).
 */
async function issueVerifyToken(
  db: ReturnType<typeof createDb>,
  userId: number,
  appBaseUrl: string
): Promise<string> {
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, 'verify_email')));
  const rawToken = generateSecureToken();
  await db.insert(authTokens).values({
    userId,
    tokenHash: await sha256Hash(rawToken),
    purpose: 'verify_email',
    expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString(),
  });
  return `${appBaseUrl}/verify-email?token=${rawToken}`;
}

/**
 * Registers a new user and issues a verification token.
 * Email-enumeration mitigation: when the email already exists, returns null
 * (the route still answers with the same generic 201 body) and writes nothing.
 *
 * @returns Verification URL + recipient details for the route to schedule
 *          emails via waitUntil, or null when the email is already registered.
 */
export async function register(
  d1: D1Database,
  appBaseUrl: string,
  input: RegisterInput
): Promise<RegisterResult> {
  const db = createDb(d1);

  const existing = await db.select().from(users).where(eq(users.email, input.email));
  if (existing.length > 0) return null;

  const passwordHash = await hashPassword(input.password);
  const inserted = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash,
      emailVerified: false,
    })
    .returning();
  const user = inserted[0];

  const verifyUrl = await issueVerifyToken(db, user.id, appBaseUrl);
  return { verifyUrl, email: user.email, name: user.name };
}

/**
 * Consumes a verification token: flips emailVerified, deletes the token row
 * (single-use — reuse returns 400).
 * @throws HTTPException 400 invalid_or_expired_token when missing or expired
 */
export async function verifyEmail(d1: D1Database, rawToken: string): Promise<number> {
  const db = createDb(d1);
  const tokenHash = await sha256Hash(rawToken);

  const rows = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.purpose, 'verify_email')));
  const token = rows[0];

  if (!token || token.expiresAt < new Date().toISOString()) {
    throw new HTTPException(400, { message: 'invalid_or_expired_token' });
  }

  await db
    .update(users)
    .set({ emailVerified: true, verifiedAt: new Date().toISOString() })
    .where(eq(users.id, token.userId));
  await db.delete(authTokens).where(eq(authTokens.id, token.id));

  return token.userId;
}

/**
 * Re-issues a verification token for an unverified user.
 * Generic regardless of account existence (enumeration mitigation).
 * @returns Verification URL + recipient, or null when nothing should be sent.
 */
export async function resendVerification(
  d1: D1Database,
  appBaseUrl: string,
  email: string
): Promise<{ verifyUrl: string; email: string } | null> {
  const db = createDb(d1);
  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows[0];
  if (!user || user.emailVerified) return null;

  const verifyUrl = await issueVerifyToken(db, user.id, appBaseUrl);
  return { verifyUrl, email: user.email };
}

/**
 * Enforces the login gate (D-07): valid credentials are required first, then
 * an unverified email hard-blocks with 403 — no session may ever be issued
 * for an unverified user.
 * @throws HTTPException 401 invalid_credentials | 403 email_not_verified
 */
export async function assertLoginAllowed(
  d1: D1Database,
  email: string,
  password: string
): Promise<{ userId: number }> {
  const db = createDb(d1);
  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows[0];

  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new HTTPException(401, { message: 'invalid_credentials' });
  }
  if (!user.emailVerified) {
    throw new HTTPException(403, { message: 'email_not_verified' });
  }
  return { userId: user.id };
}

export type LoginResult = {
  userId: number;
  accessToken: string;
  refreshToken: string;
};

/**
 * Authenticates a user and issues a new session (access JWT + opaque refresh token).
 *
 * - Checks login_attempts lockout first (T-02-02)
 * - Validates credentials with constant-time password compare
 * - Enforces email-verified gate (D-07)
 * - On success: resets login_attempts, signs access JWT, inserts refresh_tokens row
 *
 * @throws HTTPException 429 too_many_requests when locked out
 * @throws HTTPException 401 invalid_credentials for wrong password / unknown email
 * @throws HTTPException 403 email_not_verified for unverified accounts
 */
export async function login(
  d1: D1Database,
  jwtAccessSecret: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const db = createDb(d1);

  // Check for existing lockout before touching the user row
  const attemptRows = await db.select().from(loginAttempts).where(eq(loginAttempts.email, email));
  const attempt = attemptRows[0];

  if (attempt?.lockedUntil && new Date(attempt.lockedUntil) > new Date()) {
    throw new HTTPException(429, { message: 'too_many_requests' });
  }

  // Load user
  const userRows = await db.select().from(users).where(eq(users.email, email));
  const user = userRows[0];

  const passwordValid =
    user?.passwordHash != null && (await verifyPassword(password, user.passwordHash));

  if (!user || !passwordValid) {
    // Increment or upsert login_attempts (D-10: non-atomic race accepted for v1)
    if (attempt) {
      const newCount = attempt.count + 1;
      const lockedUntil =
        newCount >= MAX_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MS).toISOString()
          : attempt.lockedUntil;
      await db
        .update(loginAttempts)
        .set({ count: newCount, lastAttemptAt: new Date().toISOString(), lockedUntil })
        .where(eq(loginAttempts.email, email));
      if (newCount >= MAX_LOGIN_ATTEMPTS) {
        throw new HTTPException(429, { message: 'too_many_requests' });
      }
    } else {
      await db.insert(loginAttempts).values({
        email,
        count: 1,
        lastAttemptAt: new Date().toISOString(),
      });
    }
    throw new HTTPException(401, { message: 'invalid_credentials' });
  }

  // Credentials valid — enforce email verification gate (D-07)
  if (!user.emailVerified) {
    throw new HTTPException(403, { message: 'email_not_verified' });
  }

  // Reset login_attempts on success
  if (attempt) {
    await db
      .update(loginAttempts)
      .set({ count: 0, lockedUntil: null })
      .where(eq(loginAttempts.email, email));
  }

  // Sign access JWT and issue opaque refresh token
  const accessToken = await signAccessToken(user.id, jwtAccessSecret);
  const rawRefreshToken = generateSecureToken();
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash: await sha256Hash(rawRefreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
  });

  return { userId: user.id, accessToken, refreshToken: rawRefreshToken };
}

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
  userId: number;
};

/**
 * Rotates a refresh token (RESEARCH Pattern 7 / D-11).
 *
 * - Looks up the hashed token; missing → 401
 * - Revoked token → revokes ALL tokens for the user (theft detection) → 401 refresh_reuse_detected
 * - Expired token → 401
 * - Valid token → revoke old row, insert new row (rotatedFrom = old id), sign new access JWT
 *
 * @throws HTTPException 401 on any failure
 */
export async function refreshTokens(
  d1: D1Database,
  jwtAccessSecret: string,
  rawRefreshToken: string
): Promise<RefreshResult> {
  const db = createDb(d1);
  const tokenHash = await sha256Hash(rawRefreshToken);

  const storedRows = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, tokenHash));
  const stored = storedRows[0];

  if (!stored) {
    throw new HTTPException(401, { message: 'invalid_refresh_token' });
  }

  // Reuse detection: already-revoked token signals theft — revoke all for user
  if (stored.revokedAt !== null) {
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(refreshTokensTable.userId, stored.userId));
    throw new HTTPException(401, { message: 'refresh_reuse_detected' });
  }

  // Expired (but not revoked) token
  if (new Date(stored.expiresAt) < new Date()) {
    throw new HTTPException(401, { message: 'refresh_token_expired' });
  }

  // Rotate: revoke old row, insert new row
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokensTable.id, stored.id));

  const newRawToken = generateSecureToken();
  await db.insert(refreshTokensTable).values({
    userId: stored.userId,
    tokenHash: await sha256Hash(newRawToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
    rotatedFrom: stored.id,
  });

  const accessToken = await signAccessToken(stored.userId, jwtAccessSecret);
  return { accessToken, refreshToken: newRawToken, userId: stored.userId };
}

/**
 * Logs out a user by deleting ALL their refresh token rows (D-12: global revocation).
 * Idempotent — safe to call even if no rows exist.
 */
export async function logout(d1: D1Database, userId: number): Promise<void> {
  const db = createDb(d1);
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, userId));
}
