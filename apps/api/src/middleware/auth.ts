import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';

import { createDb } from '@app/db';
import { users } from '@app/db/schema';
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

/**
 * Admin authorization middleware — apply AFTER requireAuth.
 *
 * Reads the authenticated user's role from the DB on each request (role is
 * deliberately NOT a JWT claim, so demotions take effect immediately rather
 * than at token expiry).
 *
 * @throws HTTPException 403 forbidden when the user is not an ADMIN
 */
export const requireAdmin = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const userId = c.get('userId');
    const db = createDb(c.env.DB);
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });
    if (row?.role !== 'ADMIN') {
      throw new HTTPException(403, { message: 'forbidden' });
    }
    await next();
  }
);
