import { createMiddleware } from 'hono/factory';

import type { Bindings } from '@/types';

// The API serves JSON only — lock the CSP down completely.
const CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * Sets the security response headers required by security.md on every response.
 * HSTS is added only in production (also enforced at the Cloudflare edge —
 * kept here as defense-in-depth per plan 01-01 decisions_resolved).
 */
export const securityHeaders = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.res.headers.set('Content-Security-Policy', CSP);
  // Optional chain: tests may invoke app.request() without bindings
  if (c.env?.NODE_ENV === 'production') {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});
