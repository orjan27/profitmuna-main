import { HTTPException } from 'hono/http-exception';
import { eq, and } from 'drizzle-orm';

import { createDb } from '@app/db';
import { users, authTokens } from '@app/db/schema';

import { hashPassword, verifyPassword } from '@/lib/password';
import { generateSecureToken, sha256Hash } from '@/lib/token';

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
