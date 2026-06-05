import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';

import { schema } from '@app/db';

import { hashPassword, verifyPassword } from '@/lib/password';
import { generateSecureToken, sha256Hash, encodeHex } from '@/lib/token';
import { signAccessToken, signRefreshToken, verifyAccessToken } from '@/lib/jwt';

import { createTestDb, seedUser, mockEnv } from './helpers/db';

const env = mockEnv();

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
