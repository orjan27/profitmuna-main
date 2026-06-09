import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { securityHeaders } from '@/middleware/security-headers';
import { requireAuth, requireAdmin } from '@/middleware/auth';
import { authRouter } from '@/routes/auth';
import { incomesRouter } from '@/routes/incomes';
import { incomeCategoriesRouter } from '@/routes/income-categories';
import { expensesRouter } from '@/routes/expenses';
import { expenseCategoriesRouter } from '@/routes/expense-categories';
import { recurringIncomesRouter } from '@/routes/recurring-incomes';
import { recurringExpensesRouter } from '@/routes/recurring-expenses';
import { adminRouter } from '@/routes/admin';
import { profitMunaRouter } from '@/routes/profit-muna';
import { walletsRouter } from '@/routes/wallets';
import { dashboardRouter } from '@/routes/dashboard';
import { settingsRouter } from '@/routes/settings';
import { notificationsRouter } from '@/routes/notifications';
import { runCron } from '@/services/cron-service';
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
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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

// Income routes — guarded by requireAuth (T-02-01: every route group behind auth)
app.use('/api/incomes/*', requireAuth);
app.route('/api/incomes', incomesRouter);

app.use('/api/income-categories/*', requireAuth);
app.route('/api/income-categories', incomeCategoriesRouter);

// Expense routes — guarded by requireAuth
app.use('/api/expenses/*', requireAuth);
app.route('/api/expenses', expensesRouter);

app.use('/api/expense-categories/*', requireAuth);
app.route('/api/expense-categories', expenseCategoriesRouter);

// Recurring template routes — guarded by requireAuth
app.use('/api/recurring-incomes/*', requireAuth);
app.route('/api/recurring-incomes', recurringIncomesRouter);

app.use('/api/recurring-expenses/*', requireAuth);
app.route('/api/recurring-expenses', recurringExpensesRouter);

// Admin routes — auth + ADMIN role required on every endpoint
app.use('/api/admin/*', requireAuth, requireAdmin);
app.route('/api/admin', adminRouter);

// Profit Muna allocation routes — auth guard applied inside profitMunaRouter via .use('/*', requireAuth)
app.route('/api/profit-muna', profitMunaRouter);

// Wallet routes — auth guard applied inside walletsRouter via .use('/*', requireAuth) (T-04-01)
app.route('/api/wallets', walletsRouter);

// Dashboard routes — auth guard applied inside dashboardRouter via .use('/*', requireAuth) (T-05-01)
app.route('/api/dashboard', dashboardRouter);

// Settings routes — auth guard applied inside settingsRouter via .use('/*', requireAuth) (T-6-03)
app.route('/api/settings', settingsRouter);

// Notification routes — auth guard applied inside notificationsRouter via .use('/*', requireAuth) (T-6-07)
app.route('/api/notifications', notificationsRouter);

// Named export keeps the Hono app instance available to test helpers that call
// app.request() directly (index.test.ts, auth.test.ts use this for HTTP-layer tests).
export { app };

// Module Worker export — required for the `scheduled` handler to register (Pitfall 5).
// `export default app` is the Hono shorthand but does not support the scheduled event;
// the explicit object form exposes both fetch and scheduled (RESEARCH.md Pattern 1).
export default {
  fetch: app.fetch,

  /**
   * Hourly cron handler — fires at `0 * * * *` UTC (wrangler.toml [triggers]).
   * Converts UTC to Manila time, finds due users, emails reminders, and creates
   * INCOME_REMINDER + PENDING_INCOME_DUE in-app notifications (NOTIF-02).
   *
   * ctx.waitUntil keeps the Worker alive until all DB writes + emails complete
   * (Cloudflare Workers docs: https://developers.cloudflare.com/workers/runtime-apis/context/).
   * Local testing: `curl "http://localhost:8793/cdn-cgi/handler/scheduled"`
   */
  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runCron(env));
  },
};
