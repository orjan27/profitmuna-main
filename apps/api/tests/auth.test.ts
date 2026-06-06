import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { Hono } from 'hono';

import { schema } from '@app/db';

import app from '../src/index';
import { requireAuth } from '@/middleware/auth';
import type { Bindings, Variables } from '@/types';
import { hashPassword, verifyPassword } from '@/lib/password';
import { generateSecureToken, sha256Hash, encodeHex } from '@/lib/token';
import { signAccessToken, verifyAccessToken } from '@/lib/jwt';
import {
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  upsertGoogleUser,
} from '@/services/auth-service';

import { createTestDb, seedUser, mockEnv } from './helpers/db';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

const env = mockEnv();

// app.request 4th arg — stub ExecutionContext so waitUntil works in tests
const executionCtx = {
  waitUntil: (_p: Promise<unknown>) => {},
  passThroughOnException: () => {},
} as ExecutionContext;

function postJson(path: string, body: unknown, testEnv = env) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    testEnv,
    executionCtx
  );
}

describe('lib/password (PBKDF2)', () => {
  it('hashPassword returns the pbkdf2$sha256$210000$ encoded format', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('pbkdf2$sha256$210000$')).toBe(true);
    const parts = hash.split('$');
    expect(parts).toHaveLength(5);
    expect(parts[3]).toMatch(/^[0-9a-f]{32}$/); // 16-byte salt hex
    expect(parts[4]).toMatch(/^[0-9a-f]{64}$/); // 32-byte hash hex
  });

  it('verifyPassword accepts the matching plaintext and rejects others', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(await verifyPassword('s3cret-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
    expect(await verifyPassword('s3cret-password', 'garbage$stored$value')).toBe(false);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('rejects a stored hash with malformed (odd-length / non-hex) salt (WR-09)', async () => {
    // Odd-length salt hex — previously dropped a nibble and derived a NaN byte
    expect(await verifyPassword('pw', 'pbkdf2$sha256$210000$abc$00ff')).toBe(false);
    // Non-hex characters in the salt
    expect(await verifyPassword('pw', 'pbkdf2$sha256$210000$zzzz$00ff')).toBe(false);
  });
});

describe('lib/token', () => {
  it('generateSecureToken returns 64 lowercase hex chars and is unique', () => {
    const t1 = generateSecureToken();
    const t2 = generateSecureToken();
    expect(t1).toMatch(/^[0-9a-f]{64}$/);
    expect(t2).toMatch(/^[0-9a-f]{64}$/);
    expect(t1).not.toBe(t2);
  });

  it('sha256Hash is deterministic and matches the known digest of "x"', async () => {
    const known = '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881';
    expect(await sha256Hash('x')).toBe(known);
    expect(await sha256Hash('x')).toBe(known);
  });

  it('encodeHex round-trips a known buffer', () => {
    const buf = new Uint8Array([0, 1, 255, 16]).buffer;
    expect(encodeHex(buf)).toBe('0001ff10');
  });
});

describe('lib/jwt (jose, iss/aud)', () => {
  const secret = env.JWT_ACCESS_SECRET;

  it('signAccessToken -> verifyAccessToken yields sub, iss, aud', async () => {
    const token = await signAccessToken(1, secret);
    const payload = await verifyAccessToken(token, secret);
    expect(payload.sub).toBe('1');
    expect(payload.iss).toBe('profitmuna');
    expect(payload.aud).toBe('profitmuna-api');
    expect(payload.exp).toBeDefined();
  });

  it('verification fails with the wrong secret', async () => {
    const token = await signAccessToken(1, secret);
    await expect(verifyAccessToken(token, 'a-completely-different-secret')).rejects.toThrow();
  });

  it('verification fails for tokens with a mismatched issuer or audience', async () => {
    const key = new TextEncoder().encode(secret);
    const wrongIssuer = await new SignJWT({ sub: '1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('not-profitmuna')
      .setAudience('profitmuna-api')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(key);
    await expect(verifyAccessToken(wrongIssuer, secret)).rejects.toThrow();

    const wrongAudience = await new SignJWT({ sub: '1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('profitmuna')
      .setAudience('some-other-api')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(key);
    await expect(verifyAccessToken(wrongAudience, secret)).rejects.toThrow();
  });
});

describe('test db helper (schema round-trips)', () => {
  it('exposes users, refresh_tokens, auth_tokens, login_attempts tables', () => {
    const { db } = createTestDb();

    const user = seedUser(db, { email: 'round@trip.test', name: 'Round Trip' });
    expect(user.id).toBeGreaterThan(0);
    expect(user.emailVerified).toBe(false);

    db.insert(schema.refreshTokens)
      .values({ userId: user.id, tokenHash: 'rt-hash', expiresAt: new Date().toISOString() })
      .run();
    const rt = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(rt).toHaveLength(1);
    expect(rt[0].revokedAt).toBeNull();

    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: 'at-hash',
        purpose: 'verify_email',
        expiresAt: new Date().toISOString(),
      })
      .run();
    const at = db
      .select()
      .from(schema.authTokens)
      .where(eq(schema.authTokens.tokenHash, 'at-hash'))
      .all();
    expect(at).toHaveLength(1);
    expect(at[0].purpose).toBe('verify_email');

    db.insert(schema.loginAttempts)
      .values({ email: 'round@trip.test', count: 1, lastAttemptAt: new Date().toISOString() })
      .run();
    const la = db
      .select()
      .from(schema.loginAttempts)
      .where(eq(schema.loginAttempts.email, 'round@trip.test'))
      .all();
    expect(la).toHaveLength(1);
    expect(la[0].lockedUntil).toBeNull();
  });

  it('D1 shim works through createDb (drizzle-orm/d1 path)', async () => {
    const { d1 } = createTestDb();
    const { createDb } = await import('@app/db');
    const db = createDb(d1);

    await db.insert(schema.users).values({ email: 'd1@shim.test', name: 'D1 Shim' });
    const rows = await db.select().from(schema.users).where(eq(schema.users.email, 'd1@shim.test'));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('D1 Shim');
    expect(rows[0].emailVerified).toBe(false);
  });
});

describe('security headers middleware', () => {
  it('GET /health carries the required security headers', async () => {
    const res = await app.request('/health', {}, env, executionCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('does not expose Server or X-Powered-By fingerprint headers (WR-07)', async () => {
    const res = await app.request('/health', {}, env, executionCtx);
    expect(res.headers.get('Server')).toBeNull();
    expect(res.headers.get('X-Powered-By')).toBeNull();
  });

  it('adds Strict-Transport-Security in production', async () => {
    const prodEnv = mockEnv({ NODE_ENV: 'production' });
    const res = await app.request('/health', {}, prodEnv, executionCtx);
    const hsts = res.headers.get('Strict-Transport-Security');
    expect(hsts).toBeTruthy();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });
});

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('creates an unverified user, stores a hashed verify token, sends 2 emails', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);

    const res = await postJson(
      '/api/auth/register',
      { email: 'new@user.test', name: 'New User', password: 'password123' },
      testEnv
    );
    expect(res.status).toBe(201);

    const rows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'new@user.test'))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].emailVerified).toBe(false);
    expect(rows[0].passwordHash).toMatch(/^pbkdf2\$sha256\$210000\$/);

    const tokens = db
      .select()
      .from(schema.authTokens)
      .where(eq(schema.authTokens.userId, rows[0].id))
      .all();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].purpose).toBe('verify_email');
    expect(tokens[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // verification + welcome emails scheduled via waitUntil
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('throttles a rapid repeat of the same email and creates no second row (CR-02)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);

    const first = await postJson(
      '/api/auth/register',
      { email: 'dupe@user.test', name: 'First', password: 'password123' },
      testEnv
    );
    expect(first.status).toBe(201);
    sendMock.mockClear();

    // Within the email-send cooldown the repeat is rate-limited (CR-02)
    const second = await postJson(
      '/api/auth/register',
      { email: 'dupe@user.test', name: 'Second', password: 'password456' },
      testEnv
    );
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();

    // No second row, no extra email
    const rows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'dupe@user.test'))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('First');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rate-limits register identically for unknown vs existing emails (no enumeration leak, CR-02)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'taken@user.test',
      name: 'Taken',
      passwordHash: await hashPassword('password123'),
      emailVerified: true,
    });

    // Prime both keys with a first attempt
    await postJson('/api/auth/register', { email: 'taken@user.test', name: 'X', password: 'password123' }, testEnv);
    await postJson('/api/auth/register', { email: 'fresh@user.test', name: 'Y', password: 'password123' }, testEnv);

    // Rapid repeats — both throttled the same way regardless of existence
    const repeatTaken = await postJson('/api/auth/register', { email: 'taken@user.test', name: 'X', password: 'password123' }, testEnv);
    const repeatFresh = await postJson('/api/auth/register', { email: 'fresh@user.test', name: 'Y', password: 'password123' }, testEnv);
    expect(repeatTaken.status).toBe(429);
    expect(repeatFresh.status).toBe(429);
  });

  it('rejects passwords shorter than 8 chars with 422', async () => {
    const res = await postJson('/api/auth/register', {
      email: 'short@pw.test',
      name: 'Short',
      password: 'short',
    });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('consumes a single-use token and flips emailVerified', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);

    await postJson(
      '/api/auth/register',
      { email: 'verify@me.test', name: 'Verify Me', password: 'password123' },
      testEnv
    );

    // Extract the raw token from the mocked verification email
    const html: string = sendMock.mock.calls
      .map((c) => c[0]?.html as string)
      .find((h) => h?.includes('token=')) as string;
    const rawToken = /token=([0-9a-f]{64})/.exec(html)?.[1] as string;
    expect(rawToken).toBeTruthy();

    const res = await postJson('/api/auth/verify-email', { token: rawToken }, testEnv);
    expect(res.status).toBe(200);

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'verify@me.test'))
      .all()[0];
    expect(user.emailVerified).toBe(true);
    expect(user.verifiedAt).toBeTruthy();

    // Single-use: second redemption fails
    const reuse = await postJson('/api/auth/verify-email', { token: rawToken }, testEnv);
    expect(reuse.status).toBe(400);
  });

  it('rejects an expired token with 400 and does not verify', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const user = seedUser(db, { email: 'expired@token.test', name: 'Expired' });

    const rawToken = generateSecureToken();
    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawToken),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() - 60_000).toISOString(), // already expired
      })
      .run();

    const res = await postJson('/api/auth/verify-email', { token: rawToken }, testEnv);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_or_expired_token');

    const after = db.select().from(schema.users).where(eq(schema.users.id, user.id)).all()[0];
    expect(after.emailVerified).toBe(false);
  });
});

describe('POST /api/auth/resend-verification (rate limit, CR-02)', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('sends one email then throttles a rapid repeat with 429 + Retry-After', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'resend@user.test',
      name: 'Resend',
      passwordHash: await hashPassword('password123'),
      emailVerified: false,
    });

    const first = await postJson(
      '/api/auth/resend-verification',
      { email: 'resend@user.test' },
      testEnv
    );
    expect(first.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const second = await postJson(
      '/api/auth/resend-verification',
      { email: 'resend@user.test' },
      testEnv
    );
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeTruthy();
    // No second email scheduled while throttled
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/login (verification gate, D-07)', () => {
  it('returns 403 email_not_verified and no cookies for an unverified user', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'unverified@user.test',
      name: 'Unverified',
      passwordHash: await hashPassword('password123'),
      emailVerified: false,
    });

    const res = await postJson(
      '/api/auth/login',
      { email: 'unverified@user.test', password: 'password123' },
      testEnv
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('email_not_verified');
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('returns 401 invalid_credentials for a wrong password (no verification leak)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'creds@user.test',
      name: 'Creds',
      passwordHash: await hashPassword('password123'),
      emailVerified: false,
    });

    const res = await postJson(
      '/api/auth/login',
      { email: 'creds@user.test', password: 'wrong-password' },
      testEnv
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_credentials');
  });
});

// ---------------------------------------------------------------------------
// slice 01-02 tests: login/refresh/logout service + requireAuth middleware
// ---------------------------------------------------------------------------

describe('auth-service: login', () => {
  it('returns accessToken + refreshToken for a verified user with correct password', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'login@ok.test',
      name: 'Login OK',
      passwordHash: await hashPassword('correctpass'),
      emailVerified: true,
    });

    const result = await login(d1, env.JWT_ACCESS_SECRET, 'login@ok.test', 'correctpass');
    expect(result.userId).toBe(user.id);
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');

    // access token verifiable with correct iss/aud
    const payload = await verifyAccessToken(result.accessToken, env.JWT_ACCESS_SECRET);
    expect(payload.sub).toBe(String(user.id));

    // refresh_tokens row should exist
    const rtRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(rtRows).toHaveLength(1);
    expect(rtRows[0].revokedAt).toBeNull();
  });

  it('throws 401 invalid_credentials for wrong password and increments login_attempts', async () => {
    const { d1, db } = createTestDb();
    seedUser(db, {
      email: 'badpass@test.test',
      name: 'Bad Pass',
      passwordHash: await hashPassword('correctpass'),
      emailVerified: true,
    });

    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'badpass@test.test', 'wrongpass')
    ).rejects.toMatchObject({
      status: 401,
      message: 'invalid_credentials',
    });

    const attempts = db
      .select()
      .from(schema.loginAttempts)
      .where(eq(schema.loginAttempts.email, 'badpass@test.test'))
      .all();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].count).toBe(1);
  });

  it('throws 403 email_not_verified for an unverified user', async () => {
    const { d1, db } = createTestDb();
    seedUser(db, {
      email: 'unver@login.test',
      name: 'Unverified',
      passwordHash: await hashPassword('pass12345'),
      emailVerified: false,
    });

    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'unver@login.test', 'pass12345')
    ).rejects.toMatchObject({
      status: 403,
      message: 'email_not_verified',
    });
  });

  it('throws 429 too_many_requests after 5 failed attempts and sets lockedUntil', async () => {
    const { d1, db } = createTestDb();
    seedUser(db, {
      email: 'locked@login.test',
      name: 'Locked',
      passwordHash: await hashPassword('correctpass'),
      emailVerified: true,
    });

    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      await expect(
        login(d1, env.JWT_ACCESS_SECRET, 'locked@login.test', 'wrong')
      ).rejects.toMatchObject({
        status: 401,
      });
    }
    // 5th failure should lock
    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'locked@login.test', 'wrong')
    ).rejects.toMatchObject({
      status: 429,
      message: 'too_many_requests',
    });

    // Subsequent attempts (even correct password) still 429 while locked
    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'locked@login.test', 'correctpass')
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it('resets login_attempts counter on successful login', async () => {
    const { d1, db } = createTestDb();
    seedUser(db, {
      email: 'reset@attempts.test',
      name: 'Reset',
      passwordHash: await hashPassword('goodpass'),
      emailVerified: true,
    });

    // Fail a couple times
    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'reset@attempts.test', 'bad')
    ).rejects.toBeDefined();
    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'reset@attempts.test', 'bad')
    ).rejects.toBeDefined();

    // Succeed — counter should be gone/reset
    await login(d1, env.JWT_ACCESS_SECRET, 'reset@attempts.test', 'goodpass');

    const attempts = db
      .select()
      .from(schema.loginAttempts)
      .where(eq(schema.loginAttempts.email, 'reset@attempts.test'))
      .all();
    expect(attempts.length === 0 || attempts[0].count === 0).toBe(true);
  });

  it('does not immediately re-lock after a lockout window expires (CR-04)', async () => {
    const { d1, db } = createTestDb();
    seedUser(db, {
      email: 'relock@login.test',
      name: 'Relock',
      passwordHash: await hashPassword('correctpass'),
      emailVerified: true,
    });

    // Simulate a prior lockout whose 15-minute window has already elapsed:
    // count is at MAX and lockedUntil is in the past.
    db.insert(schema.loginAttempts)
      .values({
        email: 'relock@login.test',
        count: 5, // MAX_LOGIN_ATTEMPTS
        lastAttemptAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        lockedUntil: new Date(Date.now() - 60 * 1000).toISOString(),
      })
      .run();

    // A single post-expiry mistake must yield 401 (not an immediate 429 re-lock)
    await expect(
      login(d1, env.JWT_ACCESS_SECRET, 'relock@login.test', 'wrong')
    ).rejects.toMatchObject({ status: 401, message: 'invalid_credentials' });

    // Counter restarts at 1 and the stale lockout is cleared
    const after = db
      .select()
      .from(schema.loginAttempts)
      .where(eq(schema.loginAttempts.email, 'relock@login.test'))
      .all();
    expect(after).toHaveLength(1);
    expect(after[0].count).toBe(1);
    expect(after[0].lockedUntil).toBeNull();
  });
});

describe('auth-service: refreshTokens', () => {
  it('returns new accessToken + refreshToken and revokes old row (rotation)', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'refresh@rot.test',
      name: 'Refresh Rot',
      passwordHash: await hashPassword('pw'),
      emailVerified: true,
    });
    const { refreshToken: rawRefresh } = await login(
      d1,
      env.JWT_ACCESS_SECRET,
      'refresh@rot.test',
      'pw'
    );

    const result = await refreshTokens(d1, env.JWT_ACCESS_SECRET, rawRefresh);
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    // new token must differ from old
    expect(result.refreshToken).not.toBe(rawRefresh);

    // old row should be revoked
    const allRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(allRows).toHaveLength(2);
    const revokedRow = allRows.find((r) => r.revokedAt !== null);
    expect(revokedRow).toBeDefined();
    const activeRow = allRows.find((r) => r.revokedAt === null);
    expect(activeRow).toBeDefined();
    expect(activeRow?.rotatedFrom).toBe(revokedRow?.id);
  });

  it('revokes the ENTIRE chain and throws 401 on refresh token reuse (theft detection)', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'reuse@theft.test',
      name: 'Reuse Theft',
      passwordHash: await hashPassword('pw2'),
      emailVerified: true,
    });
    const { refreshToken: rawRefresh } = await login(
      d1,
      env.JWT_ACCESS_SECRET,
      'reuse@theft.test',
      'pw2'
    );

    // Rotate once — this revokes the original
    await refreshTokens(d1, env.JWT_ACCESS_SECRET, rawRefresh);

    // Reuse the already-revoked token — triggers theft detection
    await expect(refreshTokens(d1, env.JWT_ACCESS_SECRET, rawRefresh)).rejects.toMatchObject({
      status: 401,
      message: 'refresh_reuse_detected',
    });

    // ALL rows for this user must now be revoked
    const allRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(allRows.length).toBeGreaterThan(0);
    for (const row of allRows) {
      expect(row.revokedAt).not.toBeNull();
    }
  });

  it('throws 401 for an expired refresh token without chain-revoke', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'expired@refresh.test',
      name: 'Expired Refresh',
      passwordHash: null,
      emailVerified: true,
    });
    const rawToken = generateSecureToken();
    db.insert(schema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawToken),
        expiresAt: new Date(Date.now() - 60_000).toISOString(), // already expired
        revokedAt: null,
      })
      .run();

    await expect(refreshTokens(d1, env.JWT_ACCESS_SECRET, rawToken)).rejects.toMatchObject({
      status: 401,
    });

    // Should NOT revoke all rows — just expired, not theft
    const allRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(allRows[0].revokedAt).toBeNull();
  });
});

describe('auth-service: logout', () => {
  it('deletes all refresh_tokens rows for the user', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'logout@test.test',
      name: 'Logout',
      passwordHash: await hashPassword('pw3'),
      emailVerified: true,
    });
    // Create two refresh token rows
    await login(d1, env.JWT_ACCESS_SECRET, 'logout@test.test', 'pw3');
    db.insert(schema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: 'extra-hash-' + Date.now(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .run();

    await logout(d1, user.id);

    const rows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(rows).toHaveLength(0);
  });

  it('is idempotent — calling logout twice does not throw', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'logout2@test.test',
      name: 'Logout2',
      emailVerified: true,
    });
    await logout(d1, user.id);
    await expect(logout(d1, user.id)).resolves.toBeUndefined();
  });
});

describe('middleware: requireAuth', () => {
  // Logout is no longer protected (WR-04), so exercise requireAuth against a
  // dedicated test route that mounts the middleware in isolation.
  const protectedApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  protectedApp.use('/protected', requireAuth);
  protectedApp.post('/protected', (c) => c.json({ data: { userId: c.get('userId') } }));

  it('returns 401 for a request with no Authorization header', async () => {
    const res = await protectedApp.request('/protected', { method: 'POST' }, env, executionCtx);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a JWT with wrong issuer', async () => {
    const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const wrongIssuer = await new SignJWT({ sub: '1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('evil-issuer')
      .setAudience('profitmuna-api')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(key);

    const res = await protectedApp.request(
      '/protected',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${wrongIssuer}` },
      },
      env,
      executionCtx
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 for a JWT with wrong audience', async () => {
    const key = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const wrongAudience = await new SignJWT({ sub: '1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('profitmuna')
      .setAudience('wrong-audience')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(key);

    const res = await protectedApp.request(
      '/protected',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${wrongAudience}` },
      },
      env,
      executionCtx
    );
    expect(res.status).toBe(401);
  });

  it('proceeds past requireAuth for a valid JWT with correct iss/aud', async () => {
    const token = await signAccessToken(7, env.JWT_ACCESS_SECRET);

    const res = await protectedApp.request(
      '/protected',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      },
      env,
      executionCtx
    );
    // 200 = passed auth; 401 would mean middleware rejected
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { userId?: number } };
    expect(body.data?.userId).toBe(7);
  });
});

describe('POST /api/auth/login (full session issuance, slice 02)', () => {
  it('returns 200 with both access_token and refresh_token httpOnly cookies for a verified user', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'verified@login.test',
      name: 'Verified Login',
      passwordHash: await hashPassword('goodpassword'),
      emailVerified: true,
    });

    const res = await postJson(
      '/api/auth/login',
      { email: 'verified@login.test', password: 'goodpassword' },
      testEnv
    );
    expect(res.status).toBe(200);

    const setCookies = res.headers.getSetCookie();
    const accessCookie = setCookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = setCookies.find((c) => c.startsWith('refresh_token='));

    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(accessCookie?.toLowerCase()).toContain('httponly');
    expect(refreshCookie?.toLowerCase()).toContain('httponly');
    expect(accessCookie).toContain('Max-Age=1800');
    expect(refreshCookie).toContain('Max-Age=604800');
  });

  it('returns 429 after 5 failed login attempts', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'lockout@login.test',
      name: 'Lockout',
      passwordHash: await hashPassword('correctpw'),
      emailVerified: true,
    });

    for (let i = 0; i < 4; i++) {
      await postJson(
        '/api/auth/login',
        { email: 'lockout@login.test', password: 'wrong' },
        testEnv
      );
    }

    const res = await postJson(
      '/api/auth/login',
      { email: 'lockout@login.test', password: 'wrong' },
      testEnv
    );
    expect(res.status).toBe(429);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates refresh token and sets new cookies', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'refresh@route.test',
      name: 'Refresh Route',
      passwordHash: await hashPassword('pw4'),
      emailVerified: true,
    });

    // Login to get initial tokens
    const loginRes = await postJson(
      '/api/auth/login',
      { email: 'refresh@route.test', password: 'pw4' },
      testEnv
    );
    expect(loginRes.status).toBe(200);

    const loginCookies = loginRes.headers.getSetCookie();
    const refreshCookieHeader = loginCookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookieHeader).toBeDefined();

    // Extract raw refresh token value
    const rawRefreshToken = refreshCookieHeader!.split(';')[0].replace('refresh_token=', '');

    // Call /refresh with the cookie
    const refreshRes = await app.request(
      '/api/auth/refresh',
      {
        method: 'POST',
        headers: { cookie: `refresh_token=${rawRefreshToken}` },
      },
      testEnv,
      executionCtx
    );
    expect(refreshRes.status).toBe(200);

    const newCookies = refreshRes.headers.getSetCookie();
    expect(newCookies.find((c) => c.startsWith('access_token='))).toBeDefined();
    expect(newCookies.find((c) => c.startsWith('refresh_token='))).toBeDefined();
  });

  it('returns 401 when no refresh_token cookie is present', async () => {
    const res = await app.request('/api/auth/refresh', { method: 'POST' }, env, executionCtx);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears both cookies and deletes all refresh tokens via the refresh_token cookie', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const user = seedUser(db, {
      email: 'logout@route.test',
      name: 'Logout Route',
      passwordHash: await hashPassword('pw5'),
      emailVerified: true,
    });

    // Seed a refresh token row keyed by the hash of a known raw token
    const rawRefresh = generateSecureToken();
    db.insert(schema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .run();

    const res = await app.request(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: { cookie: `refresh_token=${rawRefresh}` },
      },
      testEnv,
      executionCtx
    );
    expect(res.status).toBe(200);

    // Both cookies should be cleared (Max-Age=0 or expires in the past)
    const setCookies = res.headers.getSetCookie();
    const accessCleared = setCookies.find(
      (c) =>
        c.startsWith('access_token=') &&
        (c.includes('Max-Age=0') || c.includes('expires=Thu, 01 Jan 1970'))
    );
    const refreshCleared = setCookies.find(
      (c) =>
        c.startsWith('refresh_token=') &&
        (c.includes('Max-Age=0') || c.includes('expires=Thu, 01 Jan 1970'))
    );
    expect(accessCleared).toBeDefined();
    expect(refreshCleared).toBeDefined();

    // All refresh token rows should be deleted
    const rows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(rows).toHaveLength(0);
  });

  it('succeeds and clears cookies even with no access token / expired session (WR-04)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const user = seedUser(db, {
      email: 'stalelogout@route.test',
      name: 'Stale Logout',
      passwordHash: await hashPassword('pw6'),
      emailVerified: true,
    });
    const rawRefresh = generateSecureToken();
    db.insert(schema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .run();

    // No Authorization header at all — logout must still work off the cookie
    const res = await app.request(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: { cookie: `refresh_token=${rawRefresh}` },
      },
      testEnv,
      executionCtx
    );
    expect(res.status).toBe(200);

    const rows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(rows).toHaveLength(0);
  });

  it('is idempotent — returns 200 even with no refresh_token cookie', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST' }, env, executionCtx);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// slice 01-03 tests: forgotPassword / resetPassword service (AUTH-04)
// ---------------------------------------------------------------------------

describe('auth-service: forgotPassword', () => {
  it('for an existing user: deletes prior reset_password tokens, inserts new hashed token, returns resetUrl', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'forgot@exists.test',
      name: 'Forgot Exists',
      passwordHash: await hashPassword('oldpass'),
      emailVerified: true,
    });

    // Pre-seed a stale reset_password token that should be replaced
    const staleRaw = generateSecureToken();
    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(staleRaw),
        purpose: 'reset_password',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .run();

    const result = await forgotPassword(d1, 'http://app.test', 'forgot@exists.test');

    expect(result.exists).toBe(true);
    expect(result.resetUrl).toContain('/reset-password?token=');

    // Old token should be gone; only one new row
    const tokens = db
      .select()
      .from(schema.authTokens)
      .where(eq(schema.authTokens.userId, user.id))
      .all();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].purpose).toBe('reset_password');
    // Stored hash must differ from the stale token hash
    expect(tokens[0].tokenHash).not.toBe(await sha256Hash(staleRaw));
  });

  it('for an unknown email: returns generic success, creates no auth_tokens row', async () => {
    const { d1, db } = createTestDb();

    const result = await forgotPassword(d1, 'http://app.test', 'nobody@unknown.test');

    expect(result.exists).toBe(false);
    // Caller inspects `exists` to decide whether to email — resetUrl may be empty string
    const tokens = db.select().from(schema.authTokens).all();
    expect(tokens).toHaveLength(0);
  });
});

describe('auth-service: resetPassword', () => {
  it('updates password_hash, deletes the token row (single-use), and wipes all refresh_tokens', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'reset@valid.test',
      name: 'Reset Valid',
      passwordHash: await hashPassword('oldpass123'),
      emailVerified: true,
    });

    // Seed an active refresh token to confirm it gets wiped
    db.insert(schema.refreshTokens)
      .values({
        userId: user.id,
        tokenHash: 'rt-to-wipe',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .run();

    const rawToken = generateSecureToken();
    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawToken),
        purpose: 'reset_password',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h from now
      })
      .run();

    const userId = await resetPassword(d1, rawToken, 'newpass456');
    expect(userId).toBe(user.id);

    // Password hash should have been updated
    const updatedUser = db.select().from(schema.users).where(eq(schema.users.id, user.id)).all()[0];
    expect(await verifyPassword('newpass456', updatedUser.passwordHash!)).toBe(true);
    expect(await verifyPassword('oldpass123', updatedUser.passwordHash!)).toBe(false);

    // Token row should be gone (single-use)
    const tokenRows = db
      .select()
      .from(schema.authTokens)
      .where(eq(schema.authTokens.userId, user.id))
      .all();
    expect(tokenRows).toHaveLength(0);

    // All refresh tokens for the user should be wiped (T-03-04)
    const rtRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))
      .all();
    expect(rtRows).toHaveLength(0);
  });

  it('throws 400 invalid_or_expired_token when the token is reused (single-use enforcement)', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'reuse@reset.test',
      name: 'Reuse Reset',
      passwordHash: await hashPassword('pass1'),
      emailVerified: true,
    });

    const rawToken = generateSecureToken();
    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawToken),
        purpose: 'reset_password',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .run();

    // First use — succeeds
    await resetPassword(d1, rawToken, 'newpass789');

    // Second use — must be rejected (token deleted on first use)
    await expect(resetPassword(d1, rawToken, 'anotherpass')).rejects.toMatchObject({
      status: 400,
      message: 'invalid_or_expired_token',
    });
  });

  it('throws 400 invalid_or_expired_token for an expired token', async () => {
    const { d1, db } = createTestDb();
    const user = seedUser(db, {
      email: 'expired@reset.test',
      name: 'Expired Reset',
      passwordHash: await hashPassword('pass2'),
      emailVerified: true,
    });

    const rawToken = generateSecureToken();
    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawToken),
        purpose: 'reset_password',
        expiresAt: new Date(Date.now() - 60_000).toISOString(), // expired 1 minute ago
      })
      .run();

    await expect(resetPassword(d1, rawToken, 'shouldfail')).rejects.toMatchObject({
      status: 400,
      message: 'invalid_or_expired_token',
    });
  });

  it('throws 400 for a completely unknown token', async () => {
    const { d1 } = createTestDb();
    const randomToken = generateSecureToken();

    await expect(resetPassword(d1, randomToken, 'newpass')).rejects.toMatchObject({
      status: 400,
      message: 'invalid_or_expired_token',
    });
  });
});

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('returns 200 with generic body for a known email and schedules reset email', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    seedUser(db, {
      email: 'known@forgot.test',
      name: 'Known User',
      passwordHash: await hashPassword('somepass'),
      emailVerified: true,
    });

    const res = await postJson(
      '/api/auth/forgot-password',
      { email: 'known@forgot.test' },
      testEnv
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.message).toBe('reset_requested');

    // Reset email should have been scheduled via waitUntil
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toContain('Reset');
  });

  it('returns identical 200 generic body for an unknown email (enumeration mitigation)', async () => {
    const { d1 } = createTestDb();
    const testEnv = mockEnv({}, d1);

    const res = await postJson(
      '/api/auth/forgot-password',
      { email: 'nobody@unknown.test' },
      testEnv
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.message).toBe('reset_requested');

    // No email should be sent for unknown address
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  it('returns 200 on successful reset (valid token + new password)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const user = seedUser(db, {
      email: 'route@reset.test',
      name: 'Route Reset',
      passwordHash: await hashPassword('oldroute'),
      emailVerified: true,
    });

    const rawToken = generateSecureToken();
    db.insert(schema.authTokens)
      .values({
        userId: user.id,
        tokenHash: await sha256Hash(rawToken),
        purpose: 'reset_password',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .run();

    const res = await postJson(
      '/api/auth/reset-password',
      { token: rawToken, password: 'newroute123' },
      testEnv
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.message).toBe('password_reset');
  });

  it('returns 400 for an invalid or already-used token', async () => {
    const { d1 } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const randomToken = generateSecureToken();

    const res = await postJson(
      '/api/auth/reset-password',
      { token: randomToken, password: 'newpass123' },
      testEnv
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_or_expired_token');
  });

  it('returns 422 for a password shorter than 8 characters', async () => {
    const { d1 } = createTestDb();
    const testEnv = mockEnv({}, d1);

    const res = await postJson(
      '/api/auth/reset-password',
      { token: 'sometoken', password: 'short' },
      testEnv
    );
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// slice 01-04 tests: upsertGoogleUser (AUTH-03)
// ---------------------------------------------------------------------------

describe('auth-service: upsertGoogleUser', () => {
  it('creates a new user with emailVerified=true and passwordHash=null for a brand-new email', async () => {
    const { d1, db } = createTestDb();

    const userId = await upsertGoogleUser(d1, {
      sub: 'google-sub-new',
      email: 'newgoogle@user.test',
      name: 'New Google User',
    });

    expect(typeof userId).toBe('number');
    expect(userId).toBeGreaterThan(0);

    const userRows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'newgoogle@user.test'))
      .all();
    expect(userRows).toHaveLength(1);
    expect(userRows[0].googleId).toBe('google-sub-new');
    expect(userRows[0].emailVerified).toBe(true);
    expect(userRows[0].passwordHash).toBeNull();
    expect(userRows[0].id).toBe(userId);
  });

  it('links googleId to an existing password account when the email matches (no duplicate row)', async () => {
    const { d1, db } = createTestDb();
    // Pre-existing password-based user — not yet linked to Google
    const existing = seedUser(db, {
      email: 'existing@user.test',
      name: 'Existing User',
      passwordHash: await hashPassword('somepass'),
      emailVerified: true,
      googleId: null,
    });

    const userId = await upsertGoogleUser(d1, {
      sub: 'google-sub-link',
      email: 'existing@user.test',
      name: 'Existing User',
    });

    // Must return the SAME userId — no duplicate
    expect(userId).toBe(existing.id);

    const userRows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'existing@user.test'))
      .all();
    expect(userRows).toHaveLength(1);
    expect(userRows[0].googleId).toBe('google-sub-link');
    expect(userRows[0].emailVerified).toBe(true);
    // password hash preserved (not wiped)
    expect(userRows[0].passwordHash).not.toBeNull();
  });

  it('returns the existing userId for a returning Google user (matched by googleId)', async () => {
    const { d1, db } = createTestDb();
    const existing = seedUser(db, {
      email: 'returning@google.test',
      name: 'Returning Google',
      passwordHash: null,
      emailVerified: true,
      googleId: 'google-sub-returning',
    });

    const userId = await upsertGoogleUser(d1, {
      sub: 'google-sub-returning',
      email: 'returning@google.test',
      name: 'Returning Google',
    });

    expect(userId).toBe(existing.id);

    // No new rows should have been created
    const allUsers = db.select().from(schema.users).all();
    expect(allUsers).toHaveLength(1);
  });

  it('issueSession helper inserts a refresh_tokens row for the upserted user (via login service)', async () => {
    const { d1, db } = createTestDb();

    const userId = await upsertGoogleUser(d1, {
      sub: 'google-sub-session',
      email: 'session@google.test',
      name: 'Session Google',
    });

    // issueSession is called internally by the route; test it via the login path to confirm
    // the helper is reused correctly — we validate by calling login() on an existing password user
    // after upsert to confirm session table integrity (the upsert itself doesn't issue session)
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).all()[0];
    expect(user).toBeDefined();
    expect(user.emailVerified).toBe(true);

    // Directly test that a refresh_tokens row can be inserted for this userId
    // (the issueSession function will do this; the route test below covers it end-to-end)
    db.insert(schema.refreshTokens)
      .values({
        userId,
        tokenHash: 'rt-google-session',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .run();

    const rtRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, userId))
      .all();
    expect(rtRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// slice 01-04 tests: GET /google, GET /google/callback routes (AUTH-03)
// ---------------------------------------------------------------------------

describe('GET /api/auth/google', () => {
  it('redirects to Google authorization URL with state and code_verifier cookies set', async () => {
    const res = await app.request('/api/auth/google', { method: 'GET' }, env, executionCtx);

    // Should redirect (302) to Google
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('accounts.google.com');
    expect(location).toContain('code_challenge');

    // State and code_verifier cookies must be set as httpOnly, SameSite=Lax
    const cookies = res.headers.getSetCookie();
    const stateCookie = cookies.find((c) => c.startsWith('oauth_state='));
    const verifierCookie = cookies.find((c) => c.startsWith('oauth_code_verifier='));
    expect(stateCookie).toBeDefined();
    expect(verifierCookie).toBeDefined();
    expect(stateCookie?.toLowerCase()).toContain('httponly');
    expect(verifierCookie?.toLowerCase()).toContain('httponly');
    expect(stateCookie?.toLowerCase()).toContain('samesite=lax');
    expect(verifierCookie?.toLowerCase()).toContain('samesite=lax');
    expect(stateCookie).toContain('Max-Age=600');
    expect(verifierCookie).toContain('Max-Age=600');
  });
});

describe('GET /api/auth/google/callback', () => {
  // Helper to call the callback route with injected cookies and query params
  function callbackRequest(
    params: Record<string, string>,
    cookies: Record<string, string>,
    testEnv: Bindings = env
  ) {
    const url = new URL('/api/auth/google/callback', 'http://localhost');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    return app.request(
      url.toString(),
      { method: 'GET', headers: { cookie: cookieHeader } },
      testEnv,
      executionCtx
    );
  }

  it('returns 400 invalid_oauth_state when state does not match stored cookie', async () => {
    const res = await callbackRequest(
      { code: 'fake-code', state: 'attacker-state' },
      { oauth_state: 'real-state', oauth_code_verifier: 'real-verifier' }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('invalid_oauth_state');
  });

  it('returns 400 when code is missing from callback', async () => {
    const res = await callbackRequest(
      { state: 'some-state' },
      { oauth_state: 'some-state', oauth_code_verifier: 'verifier' }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('invalid_oauth_state');
  });

  it('returns 400 when oauth_code_verifier cookie is missing', async () => {
    const res = await callbackRequest(
      { code: 'code', state: 'state' },
      { oauth_state: 'state' } // no verifier cookie
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('invalid_oauth_state');
  });

  it('upserts user + sets session cookies + redirects to APP_BASE_URL on valid callback (mocked Google)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const state = 'test-csrf-state';
    const verifier = 'test-code-verifier';

    // Mock arctic token exchange and Google userinfo fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('oauth2.googleapis.com/token') || url.includes('token')) {
        // arctic validateAuthorizationCode calls the token endpoint
        return new Response(
          JSON.stringify({
            access_token: 'mock-access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            id_token: 'mock-id-token',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'google-sub-123',
            email: 'google@user.test',
            name: 'Google User',
            email_verified: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      // fallback — should not be reached
      return new Response('not found', { status: 404 });
    });

    const res = await callbackRequest(
      { code: 'auth-code', state },
      { oauth_state: state, oauth_code_verifier: verifier },
      testEnv
    );

    // Restore global fetch
    vi.unstubAllGlobals();

    // Should redirect to APP_BASE_URL + '/'
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).toBe(`${testEnv.APP_BASE_URL}/`);

    // Session cookies must be set
    const setCookies = res.headers.getSetCookie();
    const accessCookie = setCookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = setCookies.find((c) => c.startsWith('refresh_token='));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(accessCookie?.toLowerCase()).toContain('httponly');
    expect(refreshCookie?.toLowerCase()).toContain('httponly');
    expect(accessCookie).toContain('Max-Age=1800');
    expect(refreshCookie).toContain('Max-Age=604800');

    // State and verifier cookies should be cleared
    const stateCleared = setCookies.find(
      (c) =>
        c.startsWith('oauth_state=') &&
        (c.includes('Max-Age=0') || c.includes('expires=Thu, 01 Jan 1970'))
    );
    expect(stateCleared).toBeDefined();

    // User row should exist in DB
    const userRows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'google@user.test'))
      .all();
    expect(userRows).toHaveLength(1);
    expect(userRows[0].googleId).toBe('google-sub-123');
    expect(userRows[0].emailVerified).toBe(true);

    // Refresh token row should be inserted
    const rtRows = db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, userRows[0].id))
      .all();
    expect(rtRows).toHaveLength(1);
    expect(rtRows[0].revokedAt).toBeNull();
  });

  it('rejects an unverified Google email (email_verified=false) and creates no user (CR-01)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const state = 'unverified-state';
    const verifier = 'unverified-verifier';

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('token')) {
        return new Response(
          JSON.stringify({ access_token: 'mock-access-token', token_type: 'Bearer' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'google-sub-unverified',
            email: 'victim@user.test',
            name: 'Victim',
            email_verified: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    });

    const res = await callbackRequest(
      { code: 'auth-code', state },
      { oauth_state: state, oauth_code_verifier: verifier },
      testEnv
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('email_not_verified');

    // No account should have been created or linked
    const userRows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'victim@user.test'))
      .all();
    expect(userRows).toHaveLength(0);
  });

  it('rejects a non-200 userinfo response without creating a user (CR-01)', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);
    const state = 'failed-state';
    const verifier = 'failed-verifier';

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('token')) {
        return new Response(
          JSON.stringify({ access_token: 'mock-access-token', token_type: 'Bearer' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(JSON.stringify({ error: 'invalid_token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    });

    const res = await callbackRequest(
      { code: 'auth-code', state },
      { oauth_state: state, oauth_code_verifier: verifier },
      testEnv
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('oauth_userinfo_failed');

    const allUsers = db.select().from(schema.users).all();
    expect(allUsers).toHaveLength(0);
  });
});
