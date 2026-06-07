---
phase: 06-settings-notifications
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - apps/api/src/index.ts
  - apps/api/src/lib/email.ts
  - apps/api/src/lib/manila-time.ts
  - apps/api/src/routes/notifications.ts
  - apps/api/src/routes/settings.ts
  - apps/api/src/schemas/notifications.ts
  - apps/api/src/schemas/settings.ts
  - apps/api/src/services/cron-service.ts
  - apps/api/src/services/notification-service.ts
  - apps/api/src/services/settings-service.ts
  - apps/api/tests/cron.test.ts
  - apps/api/tests/helpers/db.ts
  - apps/api/tests/notifications.test.ts
  - apps/api/tests/settings.test.ts
  - apps/api/wrangler.toml
  - apps/web/src/app/(dashboard)/layout.tsx
  - apps/web/src/app/(dashboard)/settings/_components/settings-form.tsx
  - apps/web/src/app/(dashboard)/settings/page.tsx
  - apps/web/src/app/api/notifications/[...path]/route.ts
  - apps/web/src/app/api/settings/[...path]/route.ts
  - apps/web/src/components/CurrencyProvider.tsx
  - apps/web/src/components/DashboardNav.tsx
  - apps/web/src/components/notifications/NotificationBell.tsx
  - apps/web/src/components/notifications/NotificationList.tsx
  - apps/web/src/lib/format-currency.ts
  - apps/web/src/types/notifications.ts
  - apps/web/src/types/settings.ts
  - packages/db/src/schema.ts
  - packages/db/migrations/0005_orange_naoko.sql
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 6 adds user settings (display currency + reminder schedule), an in-app
notification center, and an hourly cron that emails income reminders and
mirrors them as in-app notifications. The service layer is well-scoped to
`userId` (IDOR-safe), the cron uses dependency injection for the test clock, and
the BFF proxies are correct.

Two correctness defects stand out and were verified empirically:

1. **`unreadOnly` query filter is inverted** — `z.coerce.boolean()` coerces any
   non-empty string (including `"false"` and `"0"`) to `true`, so
   `?unreadOnly=false` is treated as `true`. (BLOCKER — wrong filter behavior.)
2. **Unescaped user input in notification email HTML** — the user's `name` and
   the income `categoryName` are interpolated raw into Resend HTML bodies,
   allowing stored HTML/markup injection in outbound email. (WARNING.)

There is also a latent 500 on an empty `PUT /api/settings` body, and a dead
day-31 clamp path that contradicts its own schema cap.

## Critical Issues

### CR-01: `unreadOnly` query coercion is inverted — `z.coerce.boolean()` treats `"false"` as `true`

**File:** `apps/api/src/schemas/notifications.ts:5`
**Issue:** `unreadOnly: z.coerce.boolean()` uses JavaScript `Boolean(string)`
semantics. Any non-empty string coerces to `true`. Verified:

```
parse({ unreadOnly: 'false' }) -> { unreadOnly: true }
parse({ unreadOnly: '0' })     -> { unreadOnly: true }
parse({ unreadOnly: 'true' })  -> { unreadOnly: true }
parse({})                      -> { unreadOnly: false }
```

Query strings always arrive as strings, so `GET /api/notifications?unreadOnly=false`
is parsed as `unreadOnly: true` and the list silently filters to unread-only —
the exact opposite of the caller's intent. Any client that passes the param
explicitly (rather than omitting it) gets the wrong result set. The `list`
service then applies `eq(notifications.read, false)` based on this inverted flag.

**Fix:** Parse the literal string values instead of using `coerce.boolean()`:

```ts
export const notificationQuerySchema = z.object({
  // Only the literal string "true" enables the unread filter; everything else
  // (absent, "false", "0", "") is false.
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});
```

## Warnings

### WR-01: Unescaped user input interpolated into notification email HTML (HTML/email injection)

**File:** `apps/api/src/lib/email.ts:67` and `apps/api/src/services/cron-service.ts:45,126,183`
**Issue:** `sendIncomeReminderEmail` interpolates the user's `name` directly into
the HTML body: `Hi ${name}, ...`. `name` is validated only as
`z.string().min(1).max(100)` (`apps/api/src/schemas/auth.ts:5`) with no character
restriction, so it can contain `<`, `>`, `"`, and full HTML markup. Likewise the
cron's `formatPendingDueMessage` embeds `categoryName` (user-controlled) into the
notification message. While in-app messages are rendered as text by React (auto-
escaped), the **email** body is raw HTML sent to Resend, so a name like
`<a href="https://evil">Click</a>` is delivered as live markup. Single-user app
limits blast radius, but this is still untrusted-input-into-HTML and violates
security.md ("never assign user input to innerHTML / HTML context without
escaping; escape output contextually").

**Fix:** HTML-escape interpolated user values before embedding them in email HTML:

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// ...
html: `<p>Hi ${escapeHtml(name)}, don&apos;t forget to log any income you received. ...</p>`,
```

Apply the same to `sendWelcomeEmail` (`name`) and any other user-interpolated
HTML. (`verifyUrl`/`resetUrl`/`incomePageUrl` are server-constructed, so lower
priority, but escaping them is also defensible.)

### WR-02: Empty `PUT /api/settings` body throws a 500 (Drizzle "No values to set")

**File:** `apps/api/src/services/settings-service.ts:58`
**Issue:** Every field in `updateSettingsSchema` is `.optional()`, so an empty
body `{}` passes validation (verified: `parse({}) -> {}`). `updateSettings` then
calls `db.update(users).set({})`. Drizzle throws `No values to set` on an empty
set object; this is not an `HTTPException`, so it falls through to the generic
`onError` handler and returns a 500. A client (or fuzzer) sending `PUT /api/settings`
with `{}` gets an unhandled server error instead of a 422/no-op.

**Fix:** Guard against an empty update, or require at least one field at the
schema level:

```ts
async updateSettings(userId: number, input: UpdateSettingsInput) {
  if (Object.keys(input).length === 0) return this.getSettings(userId);
  await db.update(users).set(input).where(eq(users.id, userId));
  return this.getSettings(userId);
}
```

Or add `.refine((v) => Object.keys(v).length > 0, 'at least one field required')`
to `updateSettingsSchema` so the route returns 422.

### WR-03: `markAsRead` does not validate the `:id` param — `NaN` reaches the query

**File:** `apps/api/src/routes/notifications.ts:54`
**Issue:** `const id = Number(c.req.param('id'))` produces `NaN` for a non-numeric
id (e.g. `PUT /api/notifications/abc/read`). `NaN` is then passed to
`eq(notifications.id, NaN)`. It happens to match nothing (no crash, no IDOR), but
the endpoint still returns `{ data: { success: true } }`, masking a clearly
malformed request that should be a 422. Other routes in this codebase validate
path params with Zod; this one does not.

**Fix:** Validate the param and reject non-numeric ids:

```ts
const id = Number(c.req.param('id'));
if (!Number.isInteger(id) || id < 1) {
  return c.json({ error: { code: 'validation_error', message: 'Invalid id' } }, 422);
}
```

### WR-04: Dead day-31 clamp — schema caps `reminderDayOfMonth` at 28, so the clamp can never fire

**File:** `apps/api/src/services/cron-service.ts:80-86` (and `apps/api/src/lib/manila-time.ts:59-62`)
**Issue:** `updateSettingsSchema` caps `reminderDayOfMonth` at `.max(28)`
(`apps/api/src/schemas/settings.ts:11`) and the DB column comment says the same.
But `isUserDue` MONTHLY computes `lastDayOfMonth` and clamps
`Math.min(user.reminderDayOfMonth, lastDay)` — logic that only matters for days
29–31, which can never be stored through the validated path. The clamp branch and
the `lastDayOfMonth` helper are effectively unreachable. This is contradictory: a
reviewer cannot tell whether the intent is "cap at 28" or "allow 31 with clamp."
A user wanting a month-end reminder (28th–31st) silently can only pick the 28th.

**Fix:** Pick one model and make the code self-consistent. Either (a) keep the
28-cap and delete the dead clamp + `lastDayOfMonth` helper, or (b) raise the
schema/UI cap to 31 and keep the clamp (this is the more user-friendly choice and
matches the helper's stated purpose). Document the decision in the schema comment.

### WR-05: `pending_due_notified_at` is never reset across periods — pending income can only ever notify once, forever

**File:** `apps/api/src/services/cron-service.ts:152-199`
**Issue:** `createPendingDueNotifications` filters on
`isNull(incomes.pendingDueNotifiedAt)` and stamps it permanently after the first
notification. If a user edits a pending income's `expectedReleaseDate` to a later
date (a normal correction), the stamp is already set, so the "expected today"
notification will never fire again for that income — even though the new due date
has not yet been notified. The dedup guard is per-income-lifetime, not
per-due-date. Confirm against the phase spec (D-07) whether re-notification on an
edited release date is intended; if it is, the stamp must be cleared whenever
`expectedReleaseDate` changes (likely in the out-of-scope income edit service).

**Fix:** When an income's `expectedReleaseDate` is updated, reset
`pendingDueNotifiedAt` to `null`. If lifetime-once is genuinely intended, add a
comment at the dedup site stating that editing the release date will not
re-trigger, so the behavior is not mistaken for a bug later.

## Info

### IN-01: Migration column order diverges from `schema.ts` / test DDL

**File:** `packages/db/migrations/0005_orange_naoko.sql:16-21`
**Issue:** The migration uses `ALTER TABLE users ADD ...`, which appends the new
settings columns at the _end_ of the physical table (after `created_at`). Both
`packages/db/src/schema.ts:14-26` and the test DDL (`tests/helpers/db.ts:22-28`)
place these columns _before_ `created_at`. Drizzle addresses columns by name so
this is not a runtime defect, but the divergence is misleading and could confuse
anyone diffing physical schema against the model.

**Fix:** Leave a note in the migration that physical order differs from
`schema.ts` (column-name access makes order irrelevant), or align the schema
comment ("inserted before createdAt") with reality.

### IN-02: Redundant `limit` fallback after Zod already defaults it

**File:** `apps/api/src/services/notification-service.ts:46`
**Issue:** `.limit(params.limit ?? 50)` — `notificationQuerySchema` already
applies `.default(50)`, so `params.limit` is always a number here. The `?? 50` is
dead defensive code.

**Fix:** `.limit(params.limit)`.

### IN-03: `CRON_CURRENCY_LOCALES` duplicates `CURRENCY_LOCALES` across the workspace boundary

**File:** `apps/api/src/services/cron-service.ts:19-28` vs `apps/web/src/lib/format-currency.ts:7-16`
**Issue:** The currency locale/symbol map is hand-duplicated in the API because
`apps/web` cannot be imported from `apps/api`. The code comments acknowledge this
and ask future editors to keep them in sync — a documented but fragile coupling.
If a currency is added to one and not the other, notification copy and UI drift.

**Fix:** If this grows, lift the shared map into `packages/db` or a shared
package so both sides import one source of truth. For now the comment is adequate;
flagging so it is not forgotten.

### IN-04: `notifications.test.ts` / `settings.test.ts` import `mockEnv` but never use it

**File:** `apps/api/tests/notifications.test.ts:4`, `apps/api/tests/settings.test.ts:4`
**Issue:** Both suites import `mockEnv` from the test helpers but only use
`createTestDb` and `seedUser`. Unused import; ESLint `no-unused-vars` should flag
it.

**Fix:** Drop `mockEnv` from the import in both files.

### IN-05: `cron.test.ts` uses `require('drizzle-orm')` inside an ESM test for seeding

**File:** `apps/api/tests/cron.test.ts:36,70,145`
**Issue:** Tests reach for `require('drizzle-orm').eq(...)` to build the seeding
WHERE clause instead of a top-level `import { eq } from 'drizzle-orm'`. This mixes
CJS `require` into ESM test files and relies on a `@ts-expect-error` to suppress a
typing complaint (line 34). It works under Vitest but is inconsistent with the
import style used everywhere else and obscures the type error rather than fixing
it.

**Fix:** Add `import { eq } from 'drizzle-orm';` at the top of the test and use
`eq(schema.users.id, user.id)` directly, removing the `require` calls and the
`@ts-expect-error`.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
