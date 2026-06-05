import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';

import { schema } from '@app/db';

import app from '../src/index';
import { hashPassword, verifyPassword } from '@/lib/password';
import { generateSecureToken, sha256Hash, encodeHex } from '@/lib/token';
import { signAccessToken, signRefreshToken, verifyAccessToken } from '@/lib/jwt';

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

  it('signRefreshToken produces a verifiable token with the same claims', async () => {
    const token = await signRefreshToken(42, secret);
    const payload = await verifyAccessToken(token, secret);
    expect(payload.sub).toBe('42');
    expect(payload.iss).toBe('profitmuna');
    expect(payload.aud).toBe('profitmuna-api');
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

  it('returns the same generic 201 for an existing email without a second row', async () => {
    const { d1, db } = createTestDb();
    const testEnv = mockEnv({}, d1);

    const first = await postJson(
      '/api/auth/register',
      { email: 'dupe@user.test', name: 'First', password: 'password123' },
      testEnv
    );
    const firstBody = await first.json();
    sendMock.mockClear();

    const second = await postJson(
      '/api/auth/register',
      { email: 'dupe@user.test', name: 'Second', password: 'password456' },
      testEnv
    );
    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody); // identical shape — no enumeration signal

    const rows = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'dupe@user.test'))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('First');
    expect(sendMock).not.toHaveBeenCalled();
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
