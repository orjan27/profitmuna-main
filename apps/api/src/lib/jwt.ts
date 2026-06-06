import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Fixed claims validated on every request (security.md: iss/aud/exp)
const JWT_ISSUER = 'profitmuna';
const JWT_AUDIENCE = 'profitmuna-api';

const ACCESS_TOKEN_LIFETIME = '30m';

/**
 * Signs a short-lived access token for the given user.
 * @param userId - The user's numeric id (becomes the `sub` claim)
 * @param secret - HS256 secret, read from c.env at the route — never module scope
 * @returns Signed JWT valid for 30 minutes with iss/aud claims
 */
export async function signAccessToken(userId: number, secret: string): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_LIFETIME)
    .sign(new TextEncoder().encode(secret));
}

// Note: refresh tokens are opaque random strings stored as SHA-256 hashes
// (see auth-service.ts), not signed JWTs — so there is no signRefreshToken
// and no JWT_REFRESH_SECRET binding (WR-03).

/**
 * Verifies an access token's signature, algorithm, issuer, audience, and expiry.
 * @param token - The JWT to verify
 * @param secret - HS256 secret used to sign the token
 * @returns The verified payload
 * @throws If the signature, alg, iss, aud, or exp checks fail
 */
export async function verifyAccessToken(token: string, secret: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    // Explicit allowlist prevents alg-confusion attacks
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return payload;
}
