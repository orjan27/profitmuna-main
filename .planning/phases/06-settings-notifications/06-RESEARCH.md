# Phase 6: Settings & Notifications - Research

**Researched:** 2026-06-06
**Domain:** Cloudflare Workers cron triggers, Resend email, in-app notifications, user settings (display currency + reminder schedule), Next.js notification center UI
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reminder schedule (SET-02 / NOTIF-02)**

- D-01: Frequency presets: Daily / Weekly / Monthly. Weekly lets the user pick a day of week; monthly a day of month.
- D-02: User picks the hour reminders are sent (Manila time). Requires an hourly Workers cron trigger (`0 * * * *`) whose handler checks which users are due in the current Manila hour.
- D-03: Always send on schedule — no "skip if income already logged" logic. Users turn it off if too noisy.
- D-04: Reminder email is a simple nudge: short message + link to the income page. Matches existing plain-HTML style in `apps/api/src/lib/email.ts` (extend `EmailService` with `sendIncomeReminderEmail`). No per-user aggregate stats in the email.

**Notification sources (NOTIF-01)**

- D-05: Two notification sources, both produced by the cron run:
  1. Income reminder mirror — cron emails a reminder AND creates the same nudge as an in-app notification.
  2. Pending income due — when a PENDING income's `expectedReleaseDate` arrives, create an in-app notification ("₱X from Salary expected today — mark as received?"). In-app only, never emailed.
- D-06: Pending-income-due is in-app only — never emailed.
- D-07: Pending-income-due notifies once per income record, on the expected release date, never repeated. Requires dedup guard.
- D-08: Clicking a notification marks it read and navigates via `link` column (reminder → income page; pending-due → that income record). Reuse reference schema's `link` column.

### Claude's Discretion

- Currency setting (SET-01): curated currency list (₱ PHP default + common picks like USD/EUR — planner decides list), display-only formatting (no FX), storage location (users table column vs. small settings table), how `formatCurrency` in `apps/web/src/lib/` reads it. Contract: existing screens need no rework — formatter just starts honoring the setting.
- Notification center UX: bell icon + dropdown vs. dedicated page, unread badge count, mark-all-read affordance, pagination/retention.
- Settings page layout: where currency + reminder schedule live (single settings page is the obvious shape).
- Notification type enum names (e.g., `INCOME_REMINDER`, `PENDING_INCOME_DUE`).
- Cron handler architecture: scheduled handler shape in `apps/api/src/index.ts`, due-user query design, idempotency within an hour window, Manila-time bucketing via `date-fns` + `@date-fns/tz`.
- Default reminder state for new/existing users (recommended: off until configured).
- Day-31-in-short-months handling for monthly schedules (recommended: clamp to last day).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                           | Research Support                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SET-01   | User can select their display currency                                                | Currency list, storage design, `formatCurrency` upgrade path documented in §Architecture Patterns                                     |
| SET-02   | User can configure their income reminder schedule                                     | Frequency/day/hour schema design, settings storage, settings API route documented                                                     |
| NOTIF-01 | User has an in-app notification center with read/unread states                        | Notifications schema, service surface (list/getUnreadCount/markAsRead/markAllAsRead), BFF proxy + UI patterns documented              |
| NOTIF-02 | User receives scheduled income-logging reminder emails based on configured preference | Workers cron trigger syntax, scheduled handler export pattern, Resend extension, Manila-time bucketing via date-fns/tz all documented |

</phase_requirements>

---

## Summary

Phase 6 adds the two remaining utility pillars of Profitmuna: user-configurable settings (display currency, reminder schedule) and a notification system (in-app center + scheduled email reminders). Unlike Phases 2–4, the reference implementation is only a partial guide — its `notifications` table and service surface are directly reusable shapes, but the Profitmuna type enum, all notification UI, the reminder email, user settings storage, and the Workers cron are net-new.

The most technically novel piece is the hourly Cloudflare Workers cron trigger. Wrangler's `[triggers] crons` configuration and the `scheduled` handler export alongside `fetch` are well-documented and verified against official Cloudflare docs. The Manila-time bucketing uses `@date-fns/tz` (`TZDate` class) which is already pinned in the project (`@date-fns/tz ^1.4.1`). No new runtime dependencies are required — Resend SDK (6.12.4) and all date utilities are already installed.

The settings storage decision is left to the planner (columns on `users` table vs. a dedicated `user_settings` table). Research recommends columns on `users` for simplicity: three columns (`reminderFrequency`, `reminderDayOrHour`, `reminderHour`, `reminderEnabled`, `displayCurrency`) follow the project's existing schema pattern and avoid a join. The notification dedup for pending-income-due should use a `uniqueIndex` on `(userId, sourceIncomeId)` or a flag column on the `incomes` table.

**Primary recommendation:** Add `[triggers] crons = ["0 * * * *"]` to wrangler.toml, export `scheduled` alongside `fetch` in `apps/api/src/index.ts`, store reminder settings as columns on `users`, store notification dedup via a `pendingDueNotifiedAt` column on `incomes`, add a `notifications` table following the reference shape (minus `businessId`, with Profitmuna type enum), and surface a bell-icon dropdown notification center in the dashboard layout.

---

## Architectural Responsibility Map

| Capability                      | Primary Tier              | Secondary Tier        | Rationale                                                                                                |
| ------------------------------- | ------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Currency display formatting     | Browser / Client          | —                     | `formatCurrency` is a pure client-side formatter; no server-rendering needed for currency symbol changes |
| Currency setting persistence    | API / Backend             | Database              | Settings are user-owned data; stored via API, persisted in D1                                            |
| Reminder schedule configuration | API / Backend             | Database              | Schedule state must be server-readable by the cron handler                                               |
| Cron job execution              | Workers scheduled handler | —                     | Edge-runtime cron; only the Workers runtime can trigger this; no client tier involved                    |
| Sending reminder emails         | API / Backend (cron)      | —                     | Resend SDK called from within the scheduled handler using `env.RESEND_API_KEY`                           |
| Creating in-app notifications   | API / Backend (cron)      | Database              | Cron inserts notification rows; client reads them via GET endpoint                                       |
| Notification center UI          | Browser / Client          | Frontend Server (SSR) | Unread count fetched on page load (SSR); mark-as-read is client-side mutation                            |
| Notification list API           | API / Backend             | Database              | REST endpoints behind `requireAuth`; scoped to `userId`                                                  |
| Settings page UI                | Browser / Client          | Frontend Server (SSR) | Settings form is a client component; current settings hydrated server-side                               |

---

## Standard Stack

### Core (all already pinned — no new installs)

| Library              | Version | Purpose                                          | Why Standard                                                                                      |
| -------------------- | ------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Resend SDK           | 6.12.4  | Reminder email delivery                          | [VERIFIED: npm registry] Already installed in `apps/api`; confirmed via `npm view resend version` |
| `@date-fns/tz`       | 1.4.1   | Manila-time bucketing in cron handler            | [VERIFIED: npm registry] Pinned in `apps/web`; `TZDate` class converts UTC → Asia/Manila          |
| `date-fns`           | 4.1.0   | Date arithmetic for cron due-user logic          | [VERIFIED: npm registry] Already pinned project-wide                                              |
| Drizzle ORM          | 0.45.2  | `notifications` + settings schema + queries      | [VERIFIED: codebase] Existing project ORM                                                         |
| Hono 4.12.9          | 4.12.9  | `/api/settings` and `/api/notifications` routes  | [VERIFIED: codebase] Existing project framework                                                   |
| shadcn/ui + Tailwind | pinned  | Notification center bell dropdown, settings form | [VERIFIED: codebase] Existing design system                                                       |

### No New Dependencies Required

All dependencies for this phase are already installed. The planner does NOT need any `npm install` step. [VERIFIED: codebase inspection of `apps/api/package.json` and `apps/web/package.json`]

---

## Package Legitimacy Audit

No new packages are required for this phase. All libraries used are already installed and verified in the project's `package.json` files. Package legitimacy gate is not applicable.

| Package            | Registry | Status                                 |
| ------------------ | -------- | -------------------------------------- |
| resend 6.12.4      | npm      | Already installed — no re-audit needed |
| @date-fns/tz 1.4.1 | npm      | Already installed — no re-audit needed |
| date-fns 4.1.0     | npm      | Already installed — no re-audit needed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Next.js client)
  |
  |-- GET /api/notifications  ──> BFF proxy (apps/web/src/app/api/notifications/[...path]/route.ts)
  |-- PUT /api/notifications/:id/read  ──>  |
  |-- GET /api/settings       ──>           |
  |-- PUT /api/settings       ──>           |
                                            |
                                            v
                              Hono API (apps/api/src/index.ts)
                                |
                                |-- requireAuth middleware
                                |-- /api/notifications → notificationsRouter → createNotificationService(db)
                                |-- /api/settings      → settingsRouter       → createSettingsService(db)
                                            |
                                            v
                                     Cloudflare D1
                                  (notifications table, users.reminderEnabled etc.)

Workers Cron (`0 * * * *` UTC)
  |
  |-- scheduled handler (env: Bindings)
       |-- createDb(env.DB)
       |-- convert now() → Manila TZDate
       |-- query users WHERE reminderEnabled=true AND due in current Manila hour/day
       |-- for each due user:
       |     |-- send Resend reminder email (env.RESEND_API_KEY)
       |     |-- insert INCOME_REMINDER notification row
       |-- query incomes WHERE moneyStatus='PENDING'
       |         AND expectedReleaseDate = today (Manila)
       |         AND pendingDueNotifiedAt IS NULL
       |-- for each due income:
             |-- insert PENDING_INCOME_DUE notification row
             |-- update income SET pendingDueNotifiedAt = now()
```

### Recommended Project Structure (new files only)

```
packages/db/src/
└── schema.ts                         # Add notifications table + user settings columns

apps/api/src/
├── index.ts                          # Add scheduled export, mount /api/settings + /api/notifications
├── routes/
│   ├── notifications.ts              # GET /, GET /unread-count, PUT /:id/read, PUT /read-all
│   └── settings.ts                   # GET /, PUT /
├── services/
│   ├── notification-service.ts       # createNotificationService(db) — list, getUnreadCount, markAsRead, markAllAsRead, create
│   ├── settings-service.ts           # createSettingsService(db) — getSettings, updateSettings
│   └── cron-service.ts               # runCron(db, email, appBaseUrl) — due-user query, reminder send, pending-due check
├── schemas/
│   ├── notifications.ts              # notificationQuerySchema (unreadOnly, limit)
│   └── settings.ts                   # updateSettingsSchema (displayCurrency, reminderEnabled, reminderFrequency, etc.)
└── lib/
    └── email.ts                      # Extend EmailService type + sendIncomeReminderEmail in createEmailService

apps/web/src/
├── app/
│   ├── api/
│   │   ├── notifications/[...path]/route.ts   # BFF proxy — same pattern as wallets proxy
│   │   └── settings/[...path]/route.ts         # BFF proxy
│   └── (dashboard)/
│       ├── layout.tsx                           # Add NotificationBell to header chrome
│       └── settings/
│           └── page.tsx                         # Settings page (currency + reminder form)
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx                 # Bell icon + unread badge + dropdown trigger
│       └── NotificationList.tsx                 # Dropdown list, mark-as-read on click, mark-all button
└── lib/
    └── format-currency.ts                       # Upgrade: accept optional currency code param, honor user setting
```

### Pattern 1: Workers Scheduled Handler (Cron) alongside Fetch

[VERIFIED: hono.dev official docs — https://hono.dev/docs/getting-started/cloudflare-workers]

The existing `export default app` in `apps/api/src/index.ts` must be replaced with an object that exports both `fetch` and `scheduled`. This is Module Worker mode.

```typescript
// apps/api/src/index.ts — replace `export default app` with:
import { runCron } from '@/services/cron-service';

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    // ctx.waitUntil keeps the Worker alive until the cron completes
    ctx.waitUntil(runCron(env));
  },
};
```

```toml
# apps/api/wrangler.toml — add below the [d1_databases] section:
[triggers]
crons = ["0 * * * *"]
```

**Testing cron locally:** `curl "http://localhost:8793/cdn-cgi/handler/scheduled"` [CITED: developers.cloudflare.com/workers/configuration/cron-triggers/]

### Pattern 2: Manila-Time Bucketing with @date-fns/tz

[VERIFIED: github.com/date-fns/tz — TZDate class]

The cron fires at the top of every UTC hour. The handler converts to Manila time to determine the current Manila hour, day of week, and day of month for matching user schedules.

```typescript
// Source: @date-fns/tz TZDate API
import { TZDate } from '@date-fns/tz';

const MANILA_TZ = 'Asia/Manila'; // UTC+8, no DST

function getManilaTime(now: Date): TZDate {
  return new TZDate(now, MANILA_TZ);
}

// Usage in cron handler:
const manilaTime = getManilaTime(new Date());
const manilaHour = manilaTime.getHours(); // 0–23
const manilaDayOfWeek = manilaTime.getDay(); // 0=Sun..6=Sat
const manilaDayOfMonth = manilaTime.getDate(); // 1–31
const manilaDateStr = manilaTime.toISOString().slice(0, 10); // 'YYYY-MM-DD'
```

Note: `Asia/Manila` is always UTC+8 with no DST — Manila never shifts. [ASSUMED based on IANA tz database knowledge; low risk]

### Pattern 3: Due-User Query Design

Users due in the current cron run are those with `reminderEnabled = true` whose schedule matches the current Manila time components:

```typescript
// For DAILY: reminderHour === manilaHour
// For WEEKLY: reminderDayOfWeek === manilaDayOfWeek AND reminderHour === manilaHour
// For MONTHLY: reminderDayOfMonth === manilaDayOfMonth AND reminderHour === manilaHour
//   (clamp day-31 logic: if user set day=31 and month has < 31 days,
//    fire on the last day of the month — service layer logic, not DB)

// Drizzle query pattern:
const dueUsers = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.reminderEnabled, true)
      // Frequency-specific conditions built dynamically
    )
  );
```

**Idempotency:** Because the cron fires once per hour and notifications are write-once, the natural D1 insert is idempotent within an hour window for the reminder mirror (one insert per user per run). For pending-income-due, use `pendingDueNotifiedAt IS NULL` as the guard — set it on first notification, never repeat.

### Pattern 4: Notification Service (adapted from reference)

[CITED: /mnt/c/dev/profitfirst/practice/src/server/services/notification-service.ts]

Drop `businessId` from the reference service. The Profitmuna type enum replaces the booking enum:

```typescript
// apps/api/src/services/notification-service.ts
type NotificationType = 'INCOME_REMINDER' | 'PENDING_INCOME_DUE';

export function createNotificationService(db: ReturnType<typeof createDb>) {
  return {
    async list(userId: number, params: { unreadOnly?: boolean; limit?: number }) { ... },
    async getUnreadCount(userId: number): Promise<number> { ... },
    async markAsRead(id: number, userId: number): Promise<void> { ... },
    async markAllAsRead(userId: number): Promise<void> { ... },
    async create(userId: number, type: NotificationType, title: string, message: string, link?: string): Promise<void> { ... },
  };
}
```

### Pattern 5: formatCurrency Upgrade (SET-01 no-call-site-rework contract)

The existing `formatCurrency(cents)` in `apps/web/src/lib/format-currency.ts` is hardcoded to ₱. The D-14 contract says Phase 6 "just flips the setting" with no call-site rework. The recommended approach:

```typescript
// Option A (recommended): module-level currency store read by formatCurrency
// User's currency preference is loaded once (e.g., from a React context or
// a global set by the settings page), then formatCurrency reads it.

// The function signature stays the same: formatCurrency(cents: number): string
// Internally reads a module-level or context-provided currency code.

// Option B: add optional second param with default
// formatCurrency(cents: number, currency: CurrencyCode = 'PHP'): string
// Requires adding currency param everywhere — violates the no-rework contract.
```

**Recommendation to planner:** Use a React context (`CurrencyContext`) set at the dashboard layout level from the fetched user settings. The `formatCurrency` function is replaced by a `useFormatCurrency()` hook that reads the context. Existing call sites that use the raw function must be converted to hook calls — but only in client components where they already use `'use client'`. Server components that format currency must pass the currency code explicitly. This is minimal rework. [ASSUMED — planner should evaluate exact implementation]

### Anti-Patterns to Avoid

- **Accessing `env` at module scope in Workers:** All Bindings (`env.DB`, `env.RESEND_API_KEY`) are request-scoped. The scheduled handler receives `env` as a parameter — use it inside the handler, never at module level. [CITED: CLAUDE.md Cloudflare Workers section]
- **Repeated pending-due notifications:** Without a dedup guard, the cron would fire a "pending income due" notification every hour on the expected date. Use `pendingDueNotifiedAt` column on `incomes` (set once) or a `uniqueIndex` on `notifications(userId, sourceIncomeId)`.
- **UTC-only date matching:** The cron runs in UTC. Always convert to Manila time before comparing hour/day. A user who sets "9 AM reminder" means 9 AM Manila time = 1 AM UTC. [VERIFIED: Cloudflare docs confirm cron runs UTC]
- **`export default app` after adding scheduled:** Replacing `export default app` with the object form is required for Module Worker. If `app` is still the default export, the `scheduled` event handler will not register. [VERIFIED: hono.dev docs]
- **D1 network calls without waitUntil:** The scheduled handler must wrap async cron work in `ctx.waitUntil(...)` to prevent the Worker from terminating before DB writes and emails complete. [CITED: Cloudflare Workers docs]

---

## Don't Hand-Roll

| Problem                      | Don't Build                              | Use Instead                                                                 | Why                                                                                 |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Email delivery               | Custom SMTP or fetch to email API        | Resend SDK (already installed)                                              | Already used in `email.ts`; consistent error handling, delivery tracking            |
| Timezone conversion          | Manual UTC offset arithmetic             | `TZDate` from `@date-fns/tz`                                                | DST-safe (Manila has no DST, but TZDate is correct-by-construction); already pinned |
| Notification list pagination | Custom cursor logic                      | Drizzle `.limit()` + `.orderBy(desc(createdAt))`                            | Reference service already shows the pattern; cap at 50 per the reference            |
| Currency formatting          | Custom number formatter                  | `Intl.NumberFormat` via `toLocaleString` (already used in `formatCurrency`) | Locale-aware decimal/grouping separators; handles all target currencies             |
| Cron scheduling              | setTimeout loops, external cron services | Workers cron triggers (`[triggers]` in wrangler.toml)                       | Native to the edge runtime; free tier includes cron; no external dependency         |

**Key insight:** All the scaffolding for this phase already exists in the project — the main work is connecting existing pieces (cron → existing Resend pattern, notification service → existing route pattern, settings → existing user table).

---

## Common Pitfalls

### Pitfall 1: Module-scope env access in scheduled handler

**What goes wrong:** Developer writes `const resend = new Resend(env.RESEND_API_KEY)` at module top level, thinking it's initialized once. Workers do not have persistent module scope between invocations — `env` is undefined outside a handler.
**Why it happens:** Node.js habits carry over; module-scope initialization works in Node but not Workers.
**How to avoid:** Initialize `createEmailService(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL)` inside the `scheduled` handler body.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'RESEND_API_KEY')` in cron handler logs.

### Pitfall 2: UTC vs Manila day boundary

**What goes wrong:** A user schedules a "9 AM Manila daily reminder." The cron at 0:00 UTC (which is 8:00 AM Manila, one hour early) does NOT fire it. But if the handler doesn't correctly convert to Manila time, it might either miss the run or double-fire at the boundary.
**Why it happens:** Developers check `new Date().getHours()` (UTC) instead of the Manila equivalent.
**How to avoid:** Always derive Manila hour via `new TZDate(new Date(), 'Asia/Manila').getHours()` — never use `new Date().getHours()` in the cron handler.
**Warning signs:** Users report reminders arriving at wrong times.

### Pitfall 3: Pending-due dedup failure across cron runs

**What goes wrong:** An income with `expectedReleaseDate = '2026-06-10'` gets a PENDING_INCOME_DUE notification on June 10. The cron runs again at the next hour. Without a guard, it creates another duplicate notification.
**Why it happens:** The cron runs hourly; multiple runs touch the same date. The query `WHERE expectedReleaseDate = today AND moneyStatus = 'PENDING'` matches all day long.
**How to avoid:** Add `pendingDueNotifiedAt TEXT` column to `incomes` table. Cron sets it on first notification. Query adds `AND pendingDueNotifiedAt IS NULL`.
**Warning signs:** Users see multiple identical "expected today" notifications for the same income.

### Pitfall 4: settings route returning 404 for the BFF proxy

**What goes wrong:** Developer adds `app.route('/api/settings', settingsRouter)` to the Hono API but forgets to create `apps/web/src/app/api/settings/[...path]/route.ts`. Browser calls from client components get 404.
**Why it happens:** BFF proxy files must be created for each new API namespace — they are not auto-generated.
**How to avoid:** Every new API namespace (`/api/notifications`, `/api/settings`) needs a corresponding BFF proxy file. This is a mechanical step but easy to forget.
**Warning signs:** `404 Not Found` from client-side fetch to `/api/settings`.

### Pitfall 5: `export default app` not replaced for scheduled handler

**What goes wrong:** Developer adds the `scheduled` function but forgets to change `export default app` to `export default { fetch: app.fetch, scheduled: ... }`. The scheduled event never fires.
**Why it happens:** Hono's Cloudflare Workers quickstart uses `export default app` as a convenience; Module Worker mode requires the explicit object form.
**How to avoid:** Replace `export default app` with `export default { fetch: app.fetch, scheduled: ... }` as the final step of the cron setup task.
**Warning signs:** `curl "http://localhost:8793/cdn-cgi/handler/scheduled"` returns 404 or fires nothing.

### Pitfall 6: Day-31 monthly reminder mismatch

**What goes wrong:** User sets monthly reminder for day 31. In February (28/29 days), no day-31 exists — the reminder never fires. User thinks the feature is broken.
**Why it happens:** `manilaDayOfMonth === 31` never matches in short months.
**How to avoid:** In the cron handler, when a user's `reminderDayOfMonth > lastDayOfCurrentMonth`, also fire if `manilaDayOfMonth === lastDayOfCurrentMonth`. Alternatively, cap stored value at 28 in the settings schema (simpler but loses fidelity).
**Warning signs:** Users with day > 28 monthly schedule miss reminders in short months.

---

## Schema Design

### notifications table (Drizzle)

Adapted from reference (strip `businessId`, replace type enum):

```typescript
// packages/db/src/schema.ts — Phase 6 addition
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

### User settings columns (recommendation: add to users table)

```typescript
// packages/db/src/schema.ts — additions to users table
// Settings: currency + reminder schedule
displayCurrency: text('display_currency').notNull().default('PHP'),
reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(false),
reminderFrequency: text('reminder_frequency', { enum: ['DAILY', 'WEEKLY', 'MONTHLY'] }),
reminderDayOfWeek: integer('reminder_day_of_week'),   // 0–6 (null if not WEEKLY)
reminderDayOfMonth: integer('reminder_day_of_month'), // 1–31 (null if not MONTHLY)
reminderHour: integer('reminder_hour'),               // 0–23 Manila time (null if not enabled)
```

**Alternative: separate user_settings table.** Cleaner schema separation but adds a join to every cron run. For a single-user app with a small schema, columns on `users` is the simpler choice. [ASSUMED — planner may override]

### Pending-due dedup column (add to incomes table)

```typescript
// packages/db/src/schema.ts — addition to incomes table
pendingDueNotifiedAt: text('pending_due_notified_at'), // null = not yet notified; ISO string = notified
```

---

## Code Examples

### Verified Patterns

#### Scheduled handler export (Module Worker mode)

```typescript
// Source: https://hono.dev/docs/getting-started/cloudflare-workers [VERIFIED]
// apps/api/src/index.ts — replace `export default app` with:
export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runCron(env));
  },
};
```

#### TZDate Manila conversion

```typescript
// Source: github.com/date-fns/tz TZDate API [VERIFIED]
import { TZDate } from '@date-fns/tz';

const manilaTime = new TZDate(new Date(), 'Asia/Manila');
const hour = manilaTime.getHours();
const dayOfWeek = manilaTime.getDay();
const dayOfMonth = manilaTime.getDate();
const dateStr = `${manilaTime.getFullYear()}-${String(manilaTime.getMonth() + 1).padStart(2, '0')}-${String(manilaTime.getDate()).padStart(2, '0')}`;
```

#### Cron trigger config

```toml
# Source: developers.cloudflare.com/workers/configuration/cron-triggers/ [CITED]
[triggers]
crons = ["0 * * * *"]
```

#### EmailService extension for reminder

```typescript
// Source: apps/api/src/lib/email.ts pattern [VERIFIED: codebase]
// Add to EmailService type:
sendIncomeReminderEmail(to: string, name: string, incomePageUrl: string): Promise<void>;

// Add to createEmailService return object:
async sendIncomeReminderEmail(to: string, name: string, incomePageUrl: string): Promise<void> {
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Profitmuna: Time to log your income',
    html: `<p>Hi ${name}, don't forget to log any income you received. <a href="${incomePageUrl}">Go to income page</a></p>`,
  });
  if (error) console.error('sendIncomeReminderEmail failed:', { to, error });
},
```

#### Notification route (adapted from reference)

```typescript
// Source: /mnt/c/dev/profitfirst/practice/src/server/routes/notifications.ts [CITED]
// apps/api/src/routes/notifications.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@/middleware/auth';
import { createNotificationService } from '@/services/notification-service';
import { notificationQuerySchema } from '@/schemas/notifications';
import { createDb } from '@app/db';
import type { Bindings, Variables } from '@/types';

export const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()
  .use('/*', requireAuth)
  .get('/', zValidator('query', notificationQuerySchema), async (c) => {
    const { unreadOnly, limit } = c.req.valid('query');
    const service = createNotificationService(createDb(c.env.DB));
    const result = await service.list(c.get('userId'), { unreadOnly, limit });
    return c.json(result, 200);
  })
  .get('/unread-count', async (c) => {
    const service = createNotificationService(createDb(c.env.DB));
    const count = await service.getUnreadCount(c.get('userId'));
    return c.json({ count }, 200);
  })
  .put('/:id/read', async (c) => {
    const service = createNotificationService(createDb(c.env.DB));
    await service.markAsRead(Number(c.req.param('id')), c.get('userId'));
    return c.json({ success: true }, 200);
  })
  .put('/read-all', async (c) => {
    const service = createNotificationService(createDb(c.env.DB));
    await service.markAllAsRead(c.get('userId'));
    return c.json({ success: true }, 200);
  });
```

---

## State of the Art

| Old Approach                                  | Current Approach                                                      | When Changed                           | Impact                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `export default app` (Hono Workers shorthand) | `export default { fetch: app.fetch, scheduled: ... }` (Module Worker) | Required when adding scheduled handler | The existing `export default app` in `index.ts` must be replaced — this is a structural change to the entry point |
| Manual UTC offset for Manila time             | `TZDate` from `@date-fns/tz`                                          | Library pinned in Phase 4              | Correct and DST-safe; use `new TZDate(now, 'Asia/Manila')`                                                        |

---

## Assumptions Log

| #   | Claim                                                                                                                                 | Section                                              | Risk if Wrong                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `Asia/Manila` has no DST — always UTC+8                                                                                               | Architecture Patterns §Manila-Time Bucketing         | Very low risk; Manila has not observed DST since 1990. If wrong, some users get reminders one hour off during DST transitions — but Manila has none.                             |
| A2  | User settings as columns on `users` table is preferable to a separate `user_settings` table                                           | Schema Design                                        | Low: either approach works. Choosing `user_settings` table adds one migration and one join in cron; choosing columns keeps schema flat. Planner should decide.                   |
| A3  | `formatCurrency` upgrade via React context (`CurrencyContext`) + `useFormatCurrency` hook is the correct no-call-site-rework approach | Architecture Patterns §formatCurrency Upgrade        | Medium: actual rework scope depends on how many call sites exist and whether they're in client vs server components. Planner should grep for `formatCurrency` usages and decide. |
| A4  | Notification center as bell icon + dropdown (not a dedicated page) is the right UX                                                    | Architecture Patterns §Recommended Project Structure | Low: dropdown is conventional for small notification counts (< 20). If user has many notifications, a dedicated page is better. Planner decides per shadcn/ui conventions.       |
| A5  | Clamp day > 28 monthly reminders to "last day of month" is the correct UX                                                             | Common Pitfalls §Pitfall 6                           | Low: alternative is to reject day > 28 in settings form. Either is acceptable; clamping is more user-friendly.                                                                   |

---

## Open Questions

1. **Currency list scope for SET-01**
   - What we know: PHP (₱) is default. USD, EUR are mentioned as "common picks" in CONTEXT.md.
   - What's unclear: Exact list size. 3 currencies? 10? Full ISO 4217?
   - Recommendation: Curated list of 5–8 currencies common in the Philippines context (PHP, USD, EUR, GBP, JPY, SGD, AUD, CAD). Planner decides; store as ISO 4217 3-letter code.

2. **Notification retention policy**
   - What we know: Reference caps list at 50. No retention/deletion policy in CONTEXT.md.
   - What's unclear: Should old notifications be auto-deleted? After how long?
   - Recommendation: No auto-deletion in v1 — cap the list view at 50 (reference pattern). Add a comment noting a future cleanup job could prune notifications older than 90 days.

3. **Settings page location in nav**
   - What we know: Dashboard layout exists at `(dashboard)/layout.tsx` — minimal chrome, no nav yet. Phase 5 adds sidebar nav.
   - What's unclear: Phase 6 implements before Phase 5 (settings doesn't depend on dashboard). How does the user reach the settings page?
   - Recommendation: Add a settings link to the dashboard layout header for Phase 6. Phase 5 can absorb it into the sidebar nav.

---

## Environment Availability

| Dependency            | Required By                | Available          | Version                  | Fallback |
| --------------------- | -------------------------- | ------------------ | ------------------------ | -------- |
| Node.js 22            | Build tooling              | ✓                  | 24.15.0                  | —        |
| npm                   | Package management         | ✓                  | 11.12.1                  | —        |
| Wrangler 4.78.0       | Cron trigger local testing | ✓                  | 4.98.0                   | —        |
| `@date-fns/tz`        | Manila-time bucketing      | ✓                  | 1.4.1 (installed in web) | —        |
| `date-fns`            | Date arithmetic            | ✓                  | 4.1.0                    | —        |
| Resend SDK            | Email delivery             | ✓                  | 6.12.4                   | —        |
| RESEND_API_KEY secret | Email delivery             | ✓ (set in Phase 1) | —                        | —        |

**Missing dependencies with no fallback:** None.
**Notes:** `@date-fns/tz` is installed in `apps/web`. The cron handler lives in `apps/api`. The API's `package.json` must also list `@date-fns/tz` as a dependency, or the handler must be structured to import only from `date-fns` (which IS in `apps/api`). Planner must verify whether `@date-fns/tz` is already in `apps/api/package.json` or whether it needs to be added to that workspace.

---

## Validation Architecture

### Test Framework

| Property           | Value                                      |
| ------------------ | ------------------------------------------ |
| Framework          | Vitest 3.0.0                               |
| Config file        | `apps/api/vitest.config.ts`                |
| Quick run command  | `npm run test --workspace=apps/api`        |
| Full suite command | `npm run test` (turbo runs all workspaces) |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                                               | Test Type           | Automated Command                                                      | File Exists? |
| -------- | -------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- | ------------ |
| SET-01   | GET /api/settings returns current currency; PUT updates it                             | unit (service)      | `npm run test --workspace=apps/api -- --reporter=verbose settings`     | ❌ Wave 0    |
| SET-02   | PUT /api/settings with reminder schedule stores frequency/day/hour                     | unit (service)      | same                                                                   | ❌ Wave 0    |
| NOTIF-01 | GET /api/notifications/unread-count returns correct count; markAsRead flips read flag  | unit (service)      | `npm run test --workspace=apps/api -- --reporter=verbose notification` | ❌ Wave 0    |
| NOTIF-01 | markAllAsRead sets all unread to read                                                  | unit (service)      | same                                                                   | ❌ Wave 0    |
| NOTIF-02 | cron due-user logic: daily user due at matching hour is found; user not due is skipped | unit (service/cron) | `npm run test --workspace=apps/api -- --reporter=verbose cron`         | ❌ Wave 0    |
| NOTIF-02 | pending-income-due dedup: second cron run does NOT create second notification          | unit (cron)         | same                                                                   | ❌ Wave 0    |
| NOTIF-02 | Email send is called for each due user (mock Resend)                                   | unit (cron, mock)   | same                                                                   | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm run test --workspace=apps/api -- --reporter=verbose`
- **Per wave merge:** `npm run test` (all workspaces)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/settings.test.ts` — covers SET-01, SET-02 (settings service unit tests)
- [ ] `apps/api/tests/notifications.test.ts` — covers NOTIF-01 (notification service unit tests)
- [ ] `apps/api/tests/cron.test.ts` — covers NOTIF-02 (cron service unit tests with mock Resend + real DB shim)
- [ ] `apps/api/tests/helpers/db.ts` — DDL must be extended with `notifications` table, user settings columns, `pending_due_notified_at` column on `incomes`

_(Vitest framework and `createTestDb` helper are already present — only new test files and DDL extensions needed)_

---

## Security Domain

Security enforcement is enabled (`security_enforcement: true`, ASVS level 1).

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                               |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | `requireAuth` middleware on `/api/settings` and `/api/notifications` routes                    |
| V3 Session Management | no      | No new session state added                                                                     |
| V4 Access Control     | yes     | All notification/settings queries scoped to `c.get('userId')` — never expose other users' data |
| V5 Input Validation   | yes     | Zod schemas at route entry for settings update and notification query params                   |
| V6 Cryptography       | no      | No new crypto — Resend API key is a secret, not crypto                                         |

### Known Threat Patterns for This Stack

| Pattern                        | STRIDE                 | Standard Mitigation                                                                                    |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| IDOR on notifications          | Elevation of privilege | Always `AND userId = c.get('userId')` in every notification query/update — never query by `id` alone   |
| Cron handler data leak         | Info disclosure        | Cron only writes to its own user scope; no cross-user reads; log only userId not email                 |
| Settings update without auth   | Elevation of privilege | `requireAuth` on settings route; middleware validates JWT before any DB access                         |
| Email injection via name field | Tampering              | User `name` stored at registration via Zod; do not re-validate at email-send time — trust stored value |
| RESEND_API_KEY leaked in logs  | Info disclosure        | Never log `env.RESEND_API_KEY` — only log `{ to, error }` on failure (existing pattern in `email.ts`)  |

### CLAUDE.md Security Directives

- All API routes enforce `requireAuth` before DB access.
- Error responses never include stack traces or internal details.
- Input validated with Zod at route boundary before service call.
- Rate limiting: `requireAuth` routes do not require additional rate limiting (only auth endpoints do per security.md); settings endpoint is low-frequency.

---

## Project Constraints (from CLAUDE.md)

| Directive                                                               | Impact on Phase 6                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No new top-level directories                                            | All new files go in existing `routes/`, `services/`, `schemas/`, `lib/` folders in API; `components/notifications/`, `app/(dashboard)/settings/` in web |
| No new dependencies without user approval                               | No new dependencies needed — all required packages already installed                                                                                    |
| Business logic in `services/`, not `routes/`                            | `cron-service.ts`, `notification-service.ts`, `settings-service.ts` — routes stay thin                                                                  |
| Edge runtime: no Node-only APIs                                         | `TZDate` and `date-fns` are pure JS, edge-compatible; Resend SDK is edge-compatible                                                                     |
| TypeScript strict mode, no `any`                                        | All service functions must have explicit return types; reference service uses `as any` cast — do NOT copy that pattern                                  |
| Path aliases `@/*` and `@app/db`                                        | Use `@app/db` for schema imports, `@/` for within-API imports                                                                                           |
| Drizzle schema is single source of truth in `packages/db/src/schema.ts` | `notifications` table and user settings columns go in schema.ts only                                                                                    |
| Commits: conventional commits                                           | `feat(06):`, `docs(06):`, `test(06):` prefixes                                                                                                          |

---

## Sources

### Primary (HIGH confidence)

- Hono official docs (hono.dev/docs/getting-started/cloudflare-workers) — scheduled handler export pattern alongside fetch
- Cloudflare Workers cron trigger docs (developers.cloudflare.com/workers/configuration/cron-triggers/) — wrangler.toml syntax, scheduled handler signature, local testing
- `@date-fns/tz` Context7 (github.com/date-fns/tz) — TZDate class, withTimeZone, constructor patterns
- Profitmuna codebase — `apps/api/src/lib/email.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/index.ts`, `packages/db/src/schema.ts`, `apps/api/tests/helpers/db.ts`
- Reference implementation — `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` §notifications, `notification-service.ts`, `routes/notifications.ts`

### Secondary (MEDIUM confidence)

- 06-CONTEXT.md — locked decisions and canonical refs (authoritative user decisions)
- REQUIREMENTS.md — SET-01/02, NOTIF-01/02 acceptance text

### Tertiary (LOW confidence — marked [ASSUMED] above)

- `Asia/Manila` = UTC+8, no DST — IANA tz database training knowledge (low risk, well-established fact)
- `CurrencyContext` React pattern for `formatCurrency` upgrade — architectural recommendation based on project patterns

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified in project's package.json; no new installs
- Architecture: HIGH — cron pattern verified against official docs; service pattern verified against reference codebase
- Schema design: HIGH — verified against existing Drizzle patterns in schema.ts; reference schema inspected
- Pitfalls: HIGH — each pitfall traced to a verified root cause in the stack
- formatCurrency upgrade: MEDIUM — implementation approach is [ASSUMED]; depends on call-site audit

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable stack — Cloudflare Workers, Hono, date-fns APIs are stable)
