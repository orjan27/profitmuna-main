# Phase 6: Settings & Notifications - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 17 new/modified files
**Analogs found:** 16 / 17

---

## File Classification

| New/Modified File                                            | Role       | Data Flow        | Closest Analog                                                                           | Match Quality     |
| ------------------------------------------------------------ | ---------- | ---------------- | ---------------------------------------------------------------------------------------- | ----------------- |
| `packages/db/src/schema.ts`                                  | model      | CRUD             | `packages/db/src/schema.ts` (existing)                                                   | exact (extension) |
| `apps/api/src/index.ts`                                      | config     | event-driven     | `apps/api/src/index.ts` (existing)                                                       | exact (extension) |
| `apps/api/wrangler.toml`                                     | config     | event-driven     | `apps/api/wrangler.toml` (existing)                                                      | exact (extension) |
| `apps/api/src/routes/notifications.ts`                       | route      | request-response | `apps/api/src/routes/wallets.ts`                                                         | exact             |
| `apps/api/src/routes/settings.ts`                            | route      | request-response | `apps/api/src/routes/profit-first.ts`                                                    | exact             |
| `apps/api/src/services/notification-service.ts`              | service    | CRUD             | `apps/api/src/services/wallet-service.ts`                                                | role-match        |
| `apps/api/src/services/settings-service.ts`                  | service    | CRUD             | `apps/api/src/services/profit-first-service.ts`                                          | role-match        |
| `apps/api/src/services/cron-service.ts`                      | service    | event-driven     | `apps/api/src/lib/email.ts` + `wallet-service.ts`                                        | partial           |
| `apps/api/src/schemas/notifications.ts`                      | utility    | request-response | `apps/api/src/schemas/wallets.ts`                                                        | exact             |
| `apps/api/src/schemas/settings.ts`                           | utility    | request-response | `apps/api/src/schemas/wallets.ts`                                                        | exact             |
| `apps/api/src/lib/email.ts`                                  | utility    | request-response | `apps/api/src/lib/email.ts` (existing)                                                   | exact (extension) |
| `apps/web/src/app/api/notifications/[...path]/route.ts`      | middleware | request-response | `apps/web/src/app/api/wallets/[...path]/route.ts`                                        | exact             |
| `apps/web/src/app/api/settings/[...path]/route.ts`           | middleware | request-response | `apps/web/src/app/api/wallets/[...path]/route.ts`                                        | exact             |
| `apps/web/src/app/(dashboard)/settings/page.tsx`             | component  | request-response | `apps/web/src/app/(dashboard)/profit-first/page.tsx`                                     | role-match        |
| `apps/web/src/components/notifications/NotificationBell.tsx` | component  | request-response | `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx` (DropdownMenu pattern) | role-match        |
| `apps/web/src/components/notifications/NotificationList.tsx` | component  | request-response | `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx`                        | role-match        |
| `apps/web/src/lib/format-currency.ts`                        | utility    | transform        | `apps/web/src/lib/format-currency.ts` (existing)                                         | exact (extension) |

---

## Pattern Assignments

### `packages/db/src/schema.ts` (model, CRUD — extension)

**Analog:** `packages/db/src/schema.ts` (existing file — extend, do not replace)

**Existing table declaration pattern** (lines 1–2, 71–107):

```typescript
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const incomes = sqliteTable(
  'incomes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // text enum for status:
    moneyStatus: text('money_status', { enum: ['RECEIVED', 'PENDING'] })
      .notNull()
      .default('PENDING'),
    // nullable ISO-string columns:
    expectedReleaseDate: text('expected_release_date'),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('incomes_user_status_idx').on(t.userId, t.moneyStatus),
    index('incomes_user_date_idx').on(t.userId, t.incomeDate),
  ]
);
```

**Additions needed:**

1. **New `notifications` table** — add after the wallets section, labeled `// ─── Phase 6: Notifications ───`:

```typescript
export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['INCOME_REMINDER', 'PENDING_INCOME_DUE'] }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    index('notif_user_read_created_idx').on(table.userId, table.read, table.createdAt),
    index('notif_user_read_idx').on(table.userId, table.read),
  ]
);
```

2. **User settings columns** — add to the existing `users` table definition (after `googleId`):

```typescript
// Phase 6: Settings columns
displayCurrency: text('display_currency').notNull().default('PHP'),
reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(false),
reminderFrequency: text('reminder_frequency', { enum: ['DAILY', 'WEEKLY', 'MONTHLY'] }),
reminderDayOfWeek: integer('reminder_day_of_week'),   // 0–6; null if not WEEKLY
reminderDayOfMonth: integer('reminder_day_of_month'), // 1–28; null if not MONTHLY
reminderHour: integer('reminder_hour'),               // 0–23 Manila time; null if disabled
```

3. **Pending-due dedup column** — add to the existing `incomes` table definition:

```typescript
// Phase 6: dedup guard — set once when PENDING_INCOME_DUE notification fires (D-07)
pendingDueNotifiedAt: text('pending_due_notified_at'),
```

---

### `apps/api/src/index.ts` (config, event-driven — extension)

**Analog:** `apps/api/src/index.ts` (lines 1–79, existing)

**Current export pattern** (line 78):

```typescript
export default app;
```

**Replace with Module Worker export** — required to register the `scheduled` handler:

```typescript
import { notificationsRouter } from '@/routes/notifications';
import { settingsRouter } from '@/routes/settings';
import { runCron } from '@/services/cron-service';
import type { Bindings, Variables } from '@/types';

// Add route mounts before the export (same pattern as walletsRouter — lines 76–77):
app.route('/api/notifications', notificationsRouter);
app.route('/api/settings', settingsRouter);

// Replace `export default app` with:
export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext
  ): Promise<void> {
    // waitUntil keeps the Worker alive until DB writes + emails complete
    ctx.waitUntil(runCron(env));
  },
};
```

**Existing route-mount pattern** (lines 56–77 — copy this style for new routes):

```typescript
// Wallet routes — auth guard applied inside walletsRouter via .use('/*', requireAuth)
app.route('/api/wallets', walletsRouter);
```

---

### `apps/api/wrangler.toml` (config, event-driven — extension)

**Analog:** `apps/api/wrangler.toml` (existing — check current content for placement)

**Addition only** — add after `[d1_databases]` section:

```toml
[triggers]
crons = ["0 * * * *"]
```

**RESEND env var pattern** (already present in wrangler.toml secrets section — do not add duplicates):

```
RESEND_API_KEY (secret)
RESEND_FROM_EMAIL (var or secret)
```

---

### `apps/api/src/routes/notifications.ts` (route, request-response)

**Analog:** `apps/api/src/routes/wallets.ts` (lines 1–149)

**Imports pattern** (copy from wallets.ts lines 1–14):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { createDb } from '@app/db';
import { requireAuth } from '@/middleware/auth';
import { createNotificationService } from '@/services/notification-service';
import { notificationQuerySchema } from '@/schemas/notifications';
import type { Bindings, Variables } from '@/types';
```

**Router instantiation + auth guard** (copy from wallets.ts lines 16–19):

```typescript
const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
notificationsRouter.use('/*', requireAuth);
```

**GET handler with query validation** (copy from wallets.ts lines 74–89, adapt):

```typescript
notificationsRouter.get(
  '/',
  zValidator('query', notificationQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query params' } }, 422);
    }
  }),
  async (c) => {
    const params = c.req.valid('query');
    const userId = c.get('userId');
    const svc = createNotificationService(createDb(c.env.DB));
    const result = await svc.list(userId, params);
    return c.json({ data: result });
  }
);
```

**Simple GET without validation** (copy from wallets.ts lines 22–27 shape):

```typescript
notificationsRouter.get('/unread-count', async (c) => {
  const userId = c.get('userId');
  const svc = createNotificationService(createDb(c.env.DB));
  const count = await svc.getUnreadCount(userId);
  return c.json({ data: { count } });
});
```

**PUT handlers** (copy from wallets.ts lines 47–63 shape):

> **CRITICAL ROUTE ORDER:** Register the static `/read-all` route BEFORE the dynamic `/:id/read` route. If `/:id/read` is registered first, Hono matches `read-all` as an `:id` param and `/read-all` never fires.

```typescript
notificationsRouter.put('/read-all', async (c) => {
  const userId = c.get('userId');
  const svc = createNotificationService(createDb(c.env.DB));
  await svc.markAllAsRead(userId);
  return c.json({ data: { success: true } });
});

notificationsRouter.put('/:id/read', async (c) => {
  const id = Number(c.req.param('id'));
  const userId = c.get('userId');
  const svc = createNotificationService(createDb(c.env.DB));
  await svc.markAsRead(id, userId);
  return c.json({ data: { success: true } });
});
```

**Export pattern** (wallets.ts line 149):

```typescript
export { notificationsRouter };
```

**CRITICAL ROUTE ORDER:** Register `/read-all` BEFORE `/:id/read` to avoid param shadowing — same issue documented in wallets.ts line 91–92 comment.

---

### `apps/api/src/routes/settings.ts` (route, request-response)

**Analog:** `apps/api/src/routes/profit-first.ts` (lines 1–132)

**Imports pattern** (profit-first.ts lines 1–14):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { requireAuth } from '@/middleware/auth';
import { createSettingsService } from '@/services/settings-service';
import { updateSettingsSchema } from '@/schemas/settings';
import { createDb } from '@app/db';
import type { Bindings, Variables } from '@/types';
```

**GET settings** (profit-first.ts GET /summary shape, lines 21–53):

```typescript
settingsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const svc = createSettingsService(createDb(c.env.DB));
  const settings = await svc.getSettings(userId);
  return c.json({ data: settings });
});
```

**PUT settings** (profit-first.ts PUT /percentages shape, lines 114–130):

```typescript
settingsRouter.put(
  '/',
  zValidator('json', updateSettingsSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createSettingsService(createDb(c.env.DB));
    const settings = await svc.updateSettings(userId, input);
    return c.json({ data: settings });
  }
);
```

---

### `apps/api/src/services/notification-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/wallet-service.ts` (service factory pattern, lines 75–1107)

**Service factory pattern** (wallet-service.ts lines 75–76):

```typescript
import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';

import { createDb } from '@app/db';
import { notifications } from '@app/db/schema';
import type { z } from 'zod';
import type { notificationQuerySchema } from '@/schemas/notifications';

type ListParams = z.infer<typeof notificationQuerySchema>;

export function createNotificationService(db: ReturnType<typeof createDb>) {
  return {
    async list(userId: number, params: ListParams) { ... },
    async getUnreadCount(userId: number): Promise<number> { ... },
    async markAsRead(id: number, userId: number): Promise<void> { ... },
    async markAllAsRead(userId: number): Promise<void> { ... },
    async create(
      userId: number,
      type: 'INCOME_REMINDER' | 'PENDING_INCOME_DUE',
      title: string,
      message: string,
      link?: string
    ): Promise<void> { ... },
  };
}
```

**Ownership-scoped query pattern** (wallet-service.ts lines 571–576 — always scope by userId):

```typescript
// Always use both `id` AND `userId` in WHERE to prevent IDOR (ASVS V4)
const rows = await db
  .select()
  .from(notifications)
  .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });
```

**Boolean update pattern** (wallet-service.ts update shape):

```typescript
// markAsRead
await db
  .update(notifications)
  .set({ read: true })
  .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

// markAllAsRead
await db
  .update(notifications)
  .set({ read: true })
  .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
```

**Count query pattern** (wallet-service.ts lines 626–630):

```typescript
const rows = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(notifications)
  .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
return Number(rows[0]?.count ?? 0);
```

**Paginated list** — copy `.orderBy(desc(...)).limit(...)` from existing services:

```typescript
const rows = await db
  .select()
  .from(notifications)
  .where(
    and(
      eq(notifications.userId, userId),
      params.unreadOnly ? eq(notifications.read, false) : undefined
    )
  )
  .orderBy(desc(notifications.createdAt))
  .limit(params.limit ?? 50);
```

**Error handling** (wallet-service.ts lines 576, 1052 — `HTTPException` for 404):

```typescript
if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });
```

---

### `apps/api/src/services/settings-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/profit-first-service.ts` (lines 1–60, factory pattern)

**Service factory pattern**:

```typescript
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import { users } from '@app/db/schema';
import type { z } from 'zod';
import type { updateSettingsSchema } from '@/schemas/settings';

type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export function createSettingsService(db: ReturnType<typeof createDb>) {
  return {
    async getSettings(userId: number) {
      const rows = await db
        .select({
          displayCurrency: users.displayCurrency,
          reminderEnabled: users.reminderEnabled,
          reminderFrequency: users.reminderFrequency,
          reminderDayOfWeek: users.reminderDayOfWeek,
          reminderDayOfMonth: users.reminderDayOfMonth,
          reminderHour: users.reminderHour,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (!rows[0]) throw new HTTPException(404, { message: 'not_found' });
      return rows[0];
    },

    async updateSettings(userId: number, input: UpdateSettingsInput) {
      // Ownership-scoped update — same pattern as wallet-service update()
      await db.update(users).set(input).where(eq(users.id, userId));
      return this.getSettings(userId);
    },
  };
}
```

---

### `apps/api/src/services/cron-service.ts` (service, event-driven)

**Analog:** `apps/api/src/lib/email.ts` (factory/closure pattern, lines 15–51) + `wallet-service.ts` (Drizzle query patterns)

**No direct existing cron analog** — pattern assembled from two analogs:

**Factory receiving env bindings** (email.ts lines 15–17 — never module scope):

```typescript
import { createDb } from '@app/db';
import { createEmailService } from '@/lib/email';
import { createNotificationService } from '@/services/notification-service';
import { getManilaParts, lastDayOfMonth } from '@/lib/manila-time';
import { users, incomes } from '@app/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { Bindings } from '@/types';

// Called from the scheduled handler — env passed per-invocation, never module scope.
// NOTE: @date-fns/tz is NOT in apps/api — Manila bucketing uses the local UTC+8 helper.
export async function runCron(env: Bindings): Promise<void> {
  const db = createDb(env.DB);
  const emailSvc = createEmailService(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  const notifSvc = createNotificationService(db);
  const appBaseUrl = env.APP_BASE_URL;

  // Manila time bucketing — NEVER use new Date().getHours() (UTC)
  const parts = getManilaParts(new Date());
  // parts: { hour, dayOfWeek, dayOfMonth, dateStr }

  await sendReminderEmails(db, emailSvc, notifSvc, appBaseUrl, parts);
  await createPendingDueNotifications(db, notifSvc, parts.dateStr);
}
```

**DB query pattern** (wallet-service.ts — Drizzle `and`/`eq`/`isNull`):

```typescript
// Pending-due query — isNull guard is the dedup mechanism (D-07)
const pendingIncomes = await db
  .select()
  .from(incomes)
  .where(
    and(
      eq(incomes.moneyStatus, 'PENDING'),
      eq(incomes.expectedReleaseDate, manilaDateStr),
      isNull(incomes.pendingDueNotifiedAt) // dedup: never notify twice
    )
  );
```

**Update-then-insert dedup pattern** (wallet-service.ts update shape):

> The PENDING_INCOME_DUE message currency must honor the income owner's `displayCurrency` (SET-01: ALL monetary values render in the user's chosen currency). Join/select `users.displayCurrency` for the income owner and format with the same `formatCurrency`/`CURRENCY_LOCALES` mapping used on the web. Do NOT hardcode ₱/en-PH.

```typescript
// For each pending income due: insert notification + stamp dedup column
for (const income of pendingIncomes) {
  await notifSvc.create(
    income.userId,
    'PENDING_INCOME_DUE',
    'Income expected today',
    formatPendingDueMessage(income.amount, income.categoryName, income.displayCurrency), // honor user currency
    '/income'
  );
  // Set dedup stamp immediately after insert
  await db
    .update(incomes)
    .set({ pendingDueNotifiedAt: new Date().toISOString() })
    .where(eq(incomes.id, income.id));
}
```

---

### `apps/api/src/schemas/notifications.ts` (utility, request-response)

**Analog:** `apps/api/src/schemas/wallets.ts` (lines 1–50)

**Schema file pattern** (wallets.ts lines 1–2, 47–50):

```typescript
import { z } from 'zod';

// Named exports only — matches auth.ts convention

export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});
```

---

### `apps/api/src/schemas/settings.ts` (utility, request-response)

**Analog:** `apps/api/src/schemas/wallets.ts` (lines 1–50, discriminated union pattern)

```typescript
import { z } from 'zod';

const CURRENCY_CODES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'CAD'] as const;

export const updateSettingsSchema = z.object({
  displayCurrency: z.enum(CURRENCY_CODES).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  reminderDayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  reminderDayOfMonth: z.number().int().min(1).max(28).optional().nullable(),
  reminderHour: z.number().int().min(0).max(23).optional().nullable(),
});
```

**Note on day-of-month cap:** UI spec caps the picker at 28th (line 181 of UI-SPEC.md). Schema enforces max 28 to match. This avoids the day-31 short-month pitfall entirely at input validation time.

---

### `apps/api/src/lib/email.ts` (utility, request-response — extension)

**Analog:** `apps/api/src/lib/email.ts` (lines 1–51, existing)

**Existing type + factory pattern** (lines 1–17):

```typescript
export type EmailService = {
  sendVerificationEmail(to: string, verifyUrl: string): Promise<void>;
  sendWelcomeEmail(to: string, name: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
  // Phase 6 addition:
  sendIncomeReminderEmail(to: string, name: string, incomePageUrl: string): Promise<void>;
};
```

**New method in createEmailService return object** (copy pattern from lines 31–38):

```typescript
async sendIncomeReminderEmail(to: string, name: string, incomePageUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Profitmuna: Time to log your income',
    html: `<p>Hi ${name}, don&apos;t forget to log any income you received. <a href="${incomePageUrl}">Go to income page</a></p>`,
  });
  // Same error-log pattern as all other senders (security.md: no PII bodies in logs)
  if (error) console.error('sendIncomeReminderEmail failed:', { to, error });
},
```

---

### `apps/web/src/app/api/notifications/[...path]/route.ts` (middleware, request-response)

**Analog:** `apps/web/src/app/api/wallets/[...path]/route.ts` (lines 1–62) — copy verbatim, change `/api/wallets/` to `/api/notifications/`

**Full proxy pattern** (wallets route.ts lines 9–37):

```typescript
async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const url = `${apiBaseUrl}/api/notifications/${path.join('/')}${request.nextUrl.search}`;
  const apiRes = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  return new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}
```

**Exported HTTP methods** (wallets route.ts lines 39–62 — export GET, POST, PUT; notifications needs GET + PUT only):

```typescript
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
```

---

### `apps/web/src/app/api/settings/[...path]/route.ts` (middleware, request-response)

**Analog:** `apps/web/src/app/api/wallets/[...path]/route.ts` (identical pattern — copy, change path to `/api/settings/`)

**Exported HTTP methods** — settings needs GET + PUT only.

---

### `apps/web/src/app/(dashboard)/settings/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/(dashboard)/profit-first/page.tsx` (Server Component with client child) + `pf-percentage-editor.tsx` (card + form pattern)

**Page structure** (layout.tsx pattern — Server Component shell):

```typescript
import { apiFetch } from '@/server/api';

// Server Component: fetch current settings server-side
export default async function SettingsPage() {
  const { data: settings } = await apiFetch<{ data: UserSettings }>('/api/settings');
  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-semibold leading-tight mb-6">Settings</h1>
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
```

**Card + section pattern** (pf-percentage-editor.tsx lines 92–104):

```typescript
// Section card — exact same className as pf-percentage-editor:
<div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-4">
  <h2 className="text-[20px] font-semibold leading-tight">Display Currency</h2>
  <Separator />
  <p className="text-sm text-muted-foreground">...</p>
  {/* form fields */}
</div>
```

**Submit + loading pattern** (pf-percentage-editor.tsx lines 71–90, 144–151):

```typescript
const [submitting, setSubmitting] = useState(false);

async function handleSave() {
  setSubmitting(true);
  try {
    // fetch PUT /api/settings
    toast.success('Settings saved.');
    router.refresh();
  } catch {
    toast.error('Could not save settings. Please try again.');
  } finally {
    setSubmitting(false);
  }
}

// Button:
<Button onClick={handleSave} disabled={submitting} className="self-start">
  {submitting ? 'Saving…' : 'Save Settings'}
</Button>
```

**Switch pattern** (income-form.tsx lines 249–263):

```typescript
// Enable reminders toggle — same pattern as profitFirstAllocated switch:
<div className="flex items-center justify-between rounded-lg border p-4">
  <div className="space-y-0.5">
    <Label htmlFor="reminder-enabled" className="text-sm font-semibold">
      Enable reminders
    </Label>
  </div>
  <Switch
    id="reminder-enabled"
    checked={reminderEnabled}
    onCheckedChange={setReminderEnabled}
  />
</div>
```

**Select pattern** (income-form.tsx lines 125–141):

```typescript
<Select name="reminderFrequency" value={frequency} onValueChange={setFrequency}>
  <SelectTrigger id="reminder-frequency">
    <SelectValue placeholder="Select frequency" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="DAILY">Daily</SelectItem>
    <SelectItem value="WEEKLY">Weekly</SelectItem>
    <SelectItem value="MONTHLY">Monthly</SelectItem>
  </SelectContent>
</Select>
```

---

### `apps/web/src/components/notifications/NotificationBell.tsx` (component, request-response)

**Analog:** `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx` (DropdownMenu pattern, lines 87–111)

**DropdownMenu trigger pattern** (WalletCard.tsx lines 87–111):

```typescript
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Bell trigger — same `h-8 w-8 shrink-0` size as WalletCard's MoreVertical button:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="relative h-8 w-8 shrink-0"
      aria-label="Notifications"
    >
      <Bell className={cn('h-4 w-4', unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')} />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] font-semibold tabular-nums"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-80">
    <NotificationList notifications={notifications} unreadCount={unreadCount} />
  </DropdownMenuContent>
</DropdownMenu>
```

**Props interface** (WalletCard.tsx lines 33–35, adapt):

```typescript
interface NotificationBellProps {
  unreadCount: number;
  notifications: Notification[];
}
```

---

### `apps/web/src/components/notifications/NotificationList.tsx` (component, request-response)

**Analog:** `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx` (optimistic update + router.refresh pattern, lines 38–53)

**Optimistic update + router.refresh pattern** (WalletCard.tsx lines 38–53):

```typescript
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Mark-as-read click handler — optimistic update, then API call:
function handleNotificationClick(notification: Notification) {
  // Optimistic update immediately
  setNotifications((prev) =>
    prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
  );
  // Background API call — do not block navigation
  startTransition(async () => {
    try {
      await fetch(`/api/notifications/${notification.id}/read`, { method: 'PUT' });
      router.refresh(); // rehydrate unread count in SSR parent
    } catch {
      toast.error('Could not mark notification as read.');
    }
  });
  if (notification.link) router.push(notification.link);
}
```

**Mark-all-read button pattern** (pf-percentage-editor.tsx handleSave pattern):

```typescript
const [markingAll, setMarkingAll] = useState(false);

async function handleMarkAllRead() {
  setMarkingAll(true);
  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  try {
    await fetch('/api/notifications/read-all', { method: 'PUT' });
    toast.success('All notifications marked as read.');
    router.refresh();
  } catch {
    toast.error('Could not mark all notifications as read.');
    router.refresh(); // revert optimistic state
  } finally {
    setMarkingAll(false);
  }
}
```

**Notification row class pattern** (UI-SPEC.md lines 255–258):

```typescript
// Unread row:  "flex flex-col gap-0.5 px-3 py-3 cursor-pointer rounded-md bg-accent/50 hover:bg-accent"
// Read row:    "flex flex-col gap-0.5 px-3 py-3 cursor-pointer rounded-md hover:bg-accent/50 text-muted-foreground"
const rowClass = cn(
  'flex flex-col gap-0.5 px-3 py-3 cursor-pointer rounded-md',
  notification.read ? 'hover:bg-accent/50 text-muted-foreground' : 'bg-accent/50 hover:bg-accent'
);
```

---

### `apps/web/src/lib/format-currency.ts` (utility, transform — extension)

**Analog:** `apps/web/src/lib/format-currency.ts` (lines 1–24, existing)

**Current implementation** (lines 8–13):

```typescript
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

**Upgrade approach** — per RESEARCH.md Assumption A3, the planner must decide between:

- **Option A (recommended by research):** `useFormatCurrency()` hook that reads a `CurrencyContext` set at dashboard layout level. The raw `formatCurrency` function signature stays identical but is replaced by a hook for client components. Server components that format currency pass currency code explicitly.
- **Option B:** Add optional second param with default: `formatCurrency(cents, currency = 'PHP')`. Simpler but may require call-site updates wherever the function is called in client components.

**Currency-to-locale mapping** (new const — copy `as const` pattern from DashboardNav.tsx line 16):

```typescript
const CURRENCY_LOCALES = {
  PHP: { locale: 'en-PH', symbol: '₱' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  SGD: { locale: 'en-SG', symbol: 'S$' },
  AUD: { locale: 'en-AU', symbol: 'A$' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  CAD: { locale: 'en-CA', symbol: 'C$' },
} as const satisfies Record<string, { locale: string; symbol: string }>;
```

> **Cron reuse:** The `apps/api` cron service formats the PENDING_INCOME_DUE message in the income owner's `displayCurrency`. Since `apps/web`'s `CURRENCY_LOCALES` is not importable across the workspace boundary, the cron service uses its own small inline locale/symbol mapping (same 8 codes) — keep the two in sync.

**Planner action:** Grep for all `formatCurrency(` call sites before deciding Option A vs B. Run:

```bash
grep -r "formatCurrency(" apps/web/src --include="*.tsx" --include="*.ts" -l
```

The 9 client-component call sites are enumerated in Plan 06-02 Task 3.

---

## Shared Patterns

### Authentication Guard

**Source:** `apps/api/src/middleware/auth.ts` (lines 19–35)
**Apply to:** All route files — `notificationsRouter`, `settingsRouter`

```typescript
// Mount at router level — guards every endpoint in the router:
notificationsRouter.use('/*', requireAuth);
settingsRouter.use('/*', requireAuth);
```

### Error Response Shape

**Source:** `apps/api/src/index.ts` (lines 35–46) + `apps/api/src/routes/wallets.ts` (zValidator callbacks)
**Apply to:** All route handlers

```typescript
// Validation error — always 422:
return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);

// HTTPException in services for 404/409:
throw new HTTPException(404, { message: 'not_found' });

// Generic 500 — handled by app.onError() in index.ts — do not return 500 in route handlers
```

### Ownership Scoping

**Source:** `apps/api/src/services/wallet-service.ts` (lines 571–576, 1041–1044)
**Apply to:** `notification-service.ts`, `settings-service.ts`, `cron-service.ts`

```typescript
// Every DB query that touches user data MUST include eq(table.userId, userId)
// Never query by id alone — IDOR prevention (ASVS V4)
.where(and(eq(table.id, id), eq(table.userId, userId)))
```

### Drizzle DB Instantiation in Routes

**Source:** `apps/api/src/routes/wallets.ts` (lines 24, 38, 57)
**Apply to:** All new route handlers

```typescript
// Create per-request — never cache or module-scope the Drizzle instance
const svc = createNotificationService(createDb(c.env.DB));
```

### BFF Proxy (Next.js → Workers)

**Source:** `apps/web/src/app/api/wallets/[...path]/route.ts` (lines 1–62)
**Apply to:** `notifications/[...path]/route.ts`, `settings/[...path]/route.ts`

- Copy the entire file, change only the API path prefix in the `url` construction line
- Export only the HTTP methods the resource actually needs (GET + PUT for both new namespaces)

### Toast Notification Pattern (client components)

**Source:** `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx` (lines 46–50) + `pf-percentage-editor.tsx` (lines 79–84)
**Apply to:** `SettingsForm`, `NotificationList`

```typescript
import { toast } from 'sonner';

// Success:
toast.success('Settings saved.');
// Error:
toast.error('Could not save settings. Please try again.');
// After any mutation:
router.refresh(); // rehydrates SSR data
```

### `apiFetch` from Server Components

**Source:** `apps/web/src/server/api.ts` (lines 35–58)
**Apply to:** `settings/page.tsx` (server-side settings hydration)

```typescript
import { apiFetch } from '@/server/api';

// In a Server Component or server action:
const { data } = await apiFetch<{ data: UserSettings }>('/api/settings');
```

### Environment Bindings in Scheduled Handler

**Source:** `apps/api/src/lib/email.ts` (lines 15–17) — factory receives env values as params
**Apply to:** `cron-service.ts`

```typescript
// NEVER at module scope — always receive env values inside the handler:
export async function runCron(env: Bindings): Promise<void> {
  const db = createDb(env.DB);
  const emailSvc = createEmailService(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
  // ...
}
```

---

## No Analog Found

| File                                                                         | Role    | Data Flow    | Reason                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/services/cron-service.ts` (cron scheduling + Manila bucketing) | service | event-driven | No cron/scheduled handler exists in the codebase. Pattern assembled from email.ts (factory convention) + wallet-service.ts (Drizzle query shapes) + RESEARCH.md §Pattern 2 (UTC+8 offset helper). |

---

## Migration Note

After schema additions, run `/run-migrations` to generate and apply the Drizzle migration. The test helper at `apps/api/tests/helpers/db.ts` must also be extended with DDL for:

- `notifications` table
- User settings columns on `users`
- `pending_due_notified_at` column on `incomes`

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `packages/db/src/`
**Files scanned:** 28
**Pattern extraction date:** 2026-06-06
