import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { securityHeaders } from '@/middleware/security-headers';
import { authRouter } from '@/routes/auth';
import type { Bindings, Variables } from '@/types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Allowlist the configured app origin and only the methods this API uses.
// origin is a function because the binding is request-scoped on Workers
// (security.md: never reflect a wildcard origin from an auth API).
app.use('/*', (c, next) =>
  cors({
    // Optional chain: app.request() may be invoked without bindings (tests,
    // health checks). Falling back to '' allowlists no cross-origin, which is
    // the safe default for an auth API.
    origin: c.env?.APP_BASE_URL ?? '',
    allowMethods: ['GET', 'POST'],
    credentials: false,
  })(c, next)
);
app.use('/*', securityHeaders);

// Structured error shape { error: { code, message } } for expected errors;
// generic 500 for everything else (never leak internals — security.md).
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const code = err.message || 'error';
    // Preserve a Retry-After header when the thrower attached one (e.g. 429
    // rate-limit responses — security.md requires Retry-After on throttling).
    const retryAfter = err.res?.headers.get('Retry-After');
    const headers = retryAfter ? { 'Retry-After': retryAfter } : undefined;
    return c.json({ error: { code, message: code } }, err.status, headers);
  }
  console.error('unhandled error:', { path: c.req.path, error: err });
  return c.json({ error: { code: 'internal_error', message: 'Something went wrong' } }, 500);
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Profitmuna Main API' });
});

app.route('/api/auth', authRouter);

export default app;
