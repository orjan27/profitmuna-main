import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { verifyAccessToken } from '@/lib/jwt';
import type { Bindings, Variables } from '@/types';

/**
 * JWT authentication middleware.
 *
 * Reads the Bearer token from the Authorization header, verifies it using
 * verifyAccessToken (which enforces HS256 + iss:profitmuna + aud:profitmuna-api + exp).
 * On success sets c.get('userId') to the numeric subject claim.
 *
 * IMPORTANT: We intentionally reuse verifyAccessToken from lib/jwt — never call
 * jwtVerify directly here with a looser option set (Pitfall 4 / T-02-03).
 *
 * @throws HTTPException 401 unauthorized on missing, invalid, or expired token
 */
export const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'unauthorized' });
    }
    const token = authHeader.slice(7);
    try {
      // Read secret from c.env per-request — NEVER at module scope (Workers binding is request-scoped)
      const payload = await verifyAccessToken(token, c.env.JWT_ACCESS_SECRET);
      c.set('userId', Number(payload.sub));
    } catch {
      throw new HTTPException(401, { message: 'unauthorized' });
    }
    await next();
  }
);
