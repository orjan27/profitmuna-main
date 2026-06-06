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

/**
 * A well-formed but unmatchable PBKDF2 hash used to equalise login timing
 * (CR-03). When the email is unknown or the account is Google-only
 * (passwordHash === null) we still run the full 210k-iteration derivation
 * against this constant so the response time does not reveal account
 * existence. The derived value is never expected to match a real password.
 */
const DUMMY_PASSWORD_HASH =
  'pbkdf2$sha256$210000$9c26e209ce1cb20e680edbf93dc17a52$ea39536b2dc5d43e491537ab71dda69ddb190445ff8b8167232398a8eaa453fd';

/** Maximum failed attempts before lockout */
const MAX_LOGIN_ATTEMPTS = 5;
/** Lockout window in milliseconds (15 minutes) */
const LOCKOUT_MS = 15 * 60 * 1000;
/** Refresh token lifetime in milliseconds (7 days) */
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h (D-10)
/** Reset password token lifetime in milliseconds (1 hour, D-10) */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
/**
 * Per-email cooldown for password reset requests (5 minutes).
 * Mitigates T-03-03 email-sending flood; reuses login_attempts table.
 */
const RESET_COOLDOWN_MS = 5 * 60 * 1000;
/**
 * Per-email cooldown for email-sending auth endpoints (register,
 * resend-verification). Mitigates the email-bomb / Resend cost-abuse vector
 * (CR-02); reuses the login_attempts table via a namespaced key.
 */
const EMAIL_SEND_COOLDOWN_MS = 60 * 1000;

/**
 * Enforces a per-key cooldown using the login_attempts table as lightweight
 * rate-limit storage (CR-02). Throws 429 with a Retry-After header when the
 * key is still within EMAIL_SEND_COOLDOWN_MS of its last recorded attempt;
 * otherwise records this attempt and returns. We only track lastAttemptAt
 * (no unread counter — cf. WR-08).
 *
 * @throws HTTPException 429 too_many_requests (with Retry-After) when throttled
 */
async function enforceEmailCooldown(
  db: ReturnType<typeof createDb>,
  key: string
): Promise<void> {
  const rows = await db.select().from(loginAttempts).where(eq(loginAttempts.email, key));
  const last = rows[0];
  const now = Date.now();

  if (last?.lastAttemptAt) {
    const elapsed = now - new Date(last.lastAttemptAt).getTime();
    if (elapsed < EMAIL_SEND_COOLDOWN_MS) {
      const retryAfterS = Math.ceil((EMAIL_SEND_COOLDOWN_MS - elapsed) / 1000);
      throw new HTTPException(429, {
        message: 'too_many_requests',
        res: new Response(null, { headers: { 'Retry-After': String(retryAfterS) } }),
      });
    }
  }

  const nowIso = new Date(now).toISOString();
  if (last) {
    await db
      .update(loginAttempts)
      .set({ lastAttemptAt: nowIso })
      .where(eq(loginAttempts.email, key));
  } else {
    await db.insert(loginAttempts).values({ email: key, count: 0, lastAttemptAt: nowIso });
  }
}

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

  // Throttle email-sending before any existence check so the cooldown applies
  // uniformly and never leaks whether the address exists (CR-02).
  await enforceEmailCooldown(db, `__register__${input.email}`);

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

  // Throttle email-sending before any existence check so the cooldown applies
  // uniformly and never leaks whether the address exists (CR-02).
  await enforceEmailCooldown(db, `__verify__${email}`);

  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows[0];
  if (!user || user.emailVerified) return null;

  const verifyUrl = await issueVerifyToken(db, user.id, appBaseUrl);
  return { verifyUrl, email: user.email };
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

  // Always run a PBKDF2 derivation — against a dummy hash when the user or
  // passwordHash is absent — so unknown/Google-only accounts cost the same as
  // a real one and cannot be enumerated via a timing side channel (CR-03).
  const hashToCheck = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(password, hashToCheck);
  const passwordValid = passwordMatches && user?.passwordHash != null;

  if (!user || !passwordValid) {
    // Increment or upsert login_attempts (D-10: non-atomic race accepted for v1)
    if (attempt) {
      // If a prior lockout window has already elapsed, start the counter fresh
      // so a single post-expiry mistake does not immediately re-lock the
      // account (CR-04: previously count stayed at MAX and re-locked on the
      // very next failure, enabling a low-cost account-DoS).
      const lockoutExpired =
        attempt.lockedUntil != null && new Date(attempt.lockedUntil) <= new Date();
      const baseCount = lockoutExpired ? 0 : attempt.count;
      const newCount = baseCount + 1;
      const lockedUntil =
        newCount >= MAX_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MS).toISOString()
          : null;
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

export type ForgotPasswordResult = {
  /** Whether a matching user account exists. Route uses this to decide whether to send email. */
  exists: boolean;
  /** Reset URL carrying the raw token — only meaningful when exists=true. */
  resetUrl: string;
};

/**
 * Issues a password-reset token for a user.
 *
 * - Enumeration-safe: always returns generic success; only `exists` signals whether
 *   to email (never exposed in the HTTP response body).
 * - Rate-limited: reuses login_attempts table for per-email cooldown (T-03-03).
 *   If a reset was requested within RESET_COOLDOWN_MS, skips issuing a new token.
 * - Single-active-token: deletes any prior reset_password tokens before inserting a new one.
 * - Stores only the sha256 hash in DB; raw token rides in the email link (D-09/D-10).
 *
 * @returns { exists, resetUrl } — route emails only when exists=true; never reveals
 *          existence to the caller's HTTP response.
 */
export async function forgotPassword(
  d1: D1Database,
  appBaseUrl: string,
  email: string
): Promise<ForgotPasswordResult> {
  const db = createDb(d1);

  const userRows = await db.select().from(users).where(eq(users.email, email));
  const user = userRows[0];

  if (!user) {
    return { exists: false, resetUrl: '' };
  }

  // Per-email cooldown (T-03-03): if a recent reset request exists, skip issuing a new token.
  // We reuse the login_attempts table (keyed by email) for lightweight rate-limiting.
  const attemptRows = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, `__reset__${email}`));
  const lastAttempt = attemptRows[0];

  if (
    lastAttempt?.lastAttemptAt &&
    new Date(lastAttempt.lastAttemptAt).getTime() + RESET_COOLDOWN_MS > Date.now()
  ) {
    // Still in cooldown — return generic success without issuing a new token.
    // The last token (if any) remains valid and the email was already sent.
    return { exists: true, resetUrl: '' };
  }

  // Record this reset attempt (upsert by keyed email)
  const now = new Date().toISOString();
  if (lastAttempt) {
    await db
      .update(loginAttempts)
      .set({ count: lastAttempt.count + 1, lastAttemptAt: now })
      .where(eq(loginAttempts.email, `__reset__${email}`));
  } else {
    await db.insert(loginAttempts).values({
      email: `__reset__${email}`,
      count: 1,
      lastAttemptAt: now,
    });
  }

  // Delete any prior reset_password tokens for this user (single-active-token invariant)
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, user.id), eq(authTokens.purpose, 'reset_password')));

  // Issue a new reset token (raw in link, sha256 hash in DB)
  const rawToken = generateSecureToken();
  await db.insert(authTokens).values({
    userId: user.id,
    tokenHash: await sha256Hash(rawToken),
    purpose: 'reset_password',
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
  });

  const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
  return { exists: true, resetUrl };
}

export type GoogleUserInput = {
  /** Google subject identifier (stable unique ID from the `sub` claim) */
  sub: string;
  /** Email address from Google userinfo — provider-verified */
  email: string;
  /** Display name from Google userinfo */
  name: string;
};

/**
 * Upserts a user from a Google OAuth callback (T-04-03 account-linking).
 *
 * Resolution order:
 * 1. Look up by googleId — returning Google user → return userId directly.
 * 2. Look up by email — existing password account → link googleId + mark emailVerified.
 * 3. No match → create new user (emailVerified=true, passwordHash=null).
 *
 * Google emails are provider-verified, so emailVerified is set to true in all paths.
 *
 * @returns The userId of the matched or newly created user.
 */
export async function upsertGoogleUser(
  d1: D1Database,
  googleUser: GoogleUserInput
): Promise<number> {
  const db = createDb(d1);

  // 1. Returning Google user — match by googleId
  const byGoogleId = await db.select().from(users).where(eq(users.googleId, googleUser.sub));
  if (byGoogleId.length > 0) {
    return byGoogleId[0].id;
  }

  // 2. Existing password-based account — link by email
  const byEmail = await db.select().from(users).where(eq(users.email, googleUser.email));
  if (byEmail.length > 0) {
    const user = byEmail[0];
    await db
      .update(users)
      .set({
        googleId: googleUser.sub,
        emailVerified: true,
        // Only set verifiedAt if not already set
        ...(user.verifiedAt === null ? { verifiedAt: new Date().toISOString() } : {}),
      })
      .where(eq(users.id, user.id));
    return user.id;
  }

  // 3. Brand-new Google user — auto-create verified account
  const inserted = await db
    .insert(users)
    .values({
      email: googleUser.email,
      name: googleUser.name,
      googleId: googleUser.sub,
      emailVerified: true,
      passwordHash: null,
      verifiedAt: new Date().toISOString(),
    })
    .returning();
  return inserted[0].id;
}

/**
 * Redeems a password-reset token and sets a new password.
 *
 * - Hashes the raw token and looks up the auth_tokens row (purpose=reset_password).
 * - Rejects missing/expired tokens with 400 (T-03-01 replay safety).
 * - Single-use: deletes the token row on success.
 * - Post-reset session invalidation: deletes ALL refresh_tokens for the user (T-03-04).
 * - Stores the new password as a PBKDF2-SHA256 hash (same scheme as registration).
 *
 * @throws HTTPException 400 invalid_or_expired_token when token is missing or expired
 * @returns The userId whose password was reset
 */
export async function resetPassword(
  d1: D1Database,
  rawToken: string,
  newPassword: string
): Promise<number> {
  const db = createDb(d1);
  const tokenHash = await sha256Hash(rawToken);

  const tokenRows = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.purpose, 'reset_password')));
  const token = tokenRows[0];

  if (!token || token.expiresAt < new Date().toISOString()) {
    throw new HTTPException(400, { message: 'invalid_or_expired_token' });
  }

  // Update password hash
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, token.userId));

  // Single-use: delete the token row
  await db.delete(authTokens).where(eq(authTokens.id, token.id));

  // Revoke all sessions (T-03-04: force re-login everywhere after password change)
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, token.userId));

  return token.userId;
}
