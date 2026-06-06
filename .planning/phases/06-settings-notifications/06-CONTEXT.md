# Phase 6: Settings & Notifications - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure their display currency and income-reminder schedule, and receive both in-app notifications and scheduled email reminders:

- **Settings:** user-selectable display currency (SET-01) and configurable income reminder schedule (SET-02)
- **Reminder emails:** delivered on the user's schedule via Workers cron trigger + Resend (NOTIF-02)
- **In-app notification center:** read/unread states, unread highlighting, mark-as-read (NOTIF-01)

Covers requirements **SET-01, SET-02, NOTIF-01, NOTIF-02**. Depends on Phase 1 (auth); the pending-income-due notification source reads Phase 2's `incomes` table (`moneyStatus`, `expectedReleaseDate`).

**Not in this phase:** dashboard (Phase 5), per-event activity emails (out of scope project-wide — user chose scheduled reminders instead), bank integrations, any income/expense/PF/wallet CRUD (Phases 2–4).

**Net-new territory:** unlike Phases 2–4, the reference app is only a partial guide here. Its `notifications` table + `notification-service.ts` (list, unread count, mark read, mark all read) are reusable shapes, but its notification _types_ are all booking-related and it has **no notification UI, no email integration, no user settings, and no cron** — those are net-new design for Profitmuna.

</domain>

<decisions>
## Implementation Decisions

### Reminder schedule (SET-02 / NOTIF-02)

- **D-01:** Frequency presets: **Daily / Weekly / Monthly**. Weekly lets the user pick a day of week; monthly a day of month.
- **D-02:** **User picks the hour** reminders are sent (Manila time). This requires an **hourly Workers cron trigger** (`[triggers]` in `apps/api/wrangler.toml`) whose handler checks which users are due in the current Manila hour.
- **D-03:** **Always send** on schedule — no "skip if income already logged" smartness. Users who find it noisy turn the reminder off.
- **D-04:** Reminder email is a **simple nudge**: short message + link to the income page. Matches the existing plain-HTML style in `apps/api/src/lib/email.ts` (extend `EmailService` with a `sendIncomeReminderEmail`). No per-user aggregate stats in the email.

### Notification sources (NOTIF-01)

- **D-05:** Two notification sources, both produced by the cron run:
  1. **Income reminder mirror** — when the cron emails a reminder, it also creates the same nudge as an in-app notification.
  2. **Pending income due** — when a PENDING income's `expectedReleaseDate` arrives, create an in-app notification (e.g., "₱X from Salary expected today — mark as received?").
     No welcome notification.
- **D-06:** Pending-income-due is **in-app only — never emailed**. Preserves the locked project decision against per-event emails.
- **D-07:** Pending-income-due notifies **once per income record**, on the expected release date, never repeated while overdue. Requires a dedup guard (e.g., flag on the income row or uniqueness check against existing notifications).
- **D-08:** Clicking a notification **marks it read and navigates** via the notification's `link` (reminder → income page; pending-due → that income record in the list). Reuse the reference schema's `link` column.

### Claude's Discretion

- **Currency setting (SET-01):** curated currency list (₱ PHP default, plus common picks like USD/EUR — planner decides the exact list), display-only formatting (no FX conversion), storage location (users table column vs. small settings table), and how `formatCurrency` in `apps/web/src/lib/` (Phase 4 D-14) reads it. The contract is locked: existing screens need **no rework** — the formatter just starts honoring the setting.
- **Notification center UX:** bell icon + dropdown vs. dedicated page, unread badge count, mark-all-read affordance, pagination/retention. Reference has no UI — follow shadcn/ui conventions and the reference service surface (`list`, `getUnreadCount`, `markAsRead`, `markAllAsRead`).
- **Settings page layout:** where currency + reminder schedule live (single settings page is the obvious shape).
- **Notification type enum names** (e.g., `INCOME_REMINDER`, `PENDING_INCOME_DUE`), copy/wording for emails and notifications.
- **Cron handler architecture:** scheduled handler shape in `apps/api/src/index.ts` (Workers `scheduled` export), due-user query design, idempotency within an hour window, Manila-time bucketing via `date-fns` + `@date-fns/tz`.
- Default reminder state for new/existing users (recommended: off until configured), day-31-in-short-months handling for monthly schedules (recommended: clamp to last day).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference implementation (partial fidelity — schema/service shapes only)

- `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` §notifications (lines ~437–462) — table shape: type enum, title, message, link, read flag, `(userId, read, createdAt)` indexes. Strip `businessId` → scope by `userId`; replace booking type enum with Profitmuna types.
- `/mnt/c/dev/profitfirst/practice/src/server/services/notification-service.ts` — service surface to replicate: `list` (paginated), `getUnreadCount`, `markAsRead`, `markAllAsRead`, `create`
- `/mnt/c/dev/profitfirst/practice/src/server/routes/notifications.ts` — route surface to replicate
- **Note:** reference has NO notification UI, NO email, NO cron, NO settings — those are net-new for Profitmuna.

### Existing Profitmuna code this phase extends

- `apps/api/src/lib/email.ts` — `createEmailService(apiKey, fromEmail)` pattern; add the reminder sender here
- `apps/api/wrangler.toml` — cron `[triggers]` must be added here; `RESEND_FROM_EMAIL` / secrets conventions documented in comments
- `apps/api/src/middleware/auth.ts` — `requireAuth` for settings + notifications routes

### Project planning docs

- `.planning/PROJECT.md` — locked decisions: Resend for all email, reminder-emails-not-per-event, Manila timezone notes, single-user scoping
- `.planning/REQUIREMENTS.md` §Notifications, §Settings — SET-01/02, NOTIF-01/02 acceptance text
- `.planning/ROADMAP.md` §"Phase 6: Settings & Notifications" — goal + 3 success criteria
- `.planning/phases/04-wallets/04-CONTEXT.md` D-14 — shared `formatCurrency` contract (₱ default; Phase 6 "just flips the setting")
- `.planning/phases/02-income-expenses/02-CONTEXT.md` D-08 — currency helper origin; income schema (`moneyStatus`, `expectedReleaseDate`) the pending-due source reads
- `.planning/phases/01-authentication/01-CONTEXT.md` — BFF proxy + auth patterns the settings/notifications routes inherit

### Codebase rules

- `CLAUDE.md` + `STANDARDS.md` + `.claude/rules/structure.md` — STRICT structure: routes thin in `apps/api/src/routes/`, logic in `services/`, Zod in `schemas/`, schema in `packages/db/src/schema.ts`; edge runtime (no Node-only APIs)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api/src/lib/email.ts` — Resend-backed `EmailService` factory; reminder email is a fourth sender on the same pattern (API key from `c.env`/`env`, never module scope)
- `apps/api/src/middleware/auth.ts` (`requireAuth`) — settings + notifications routes mount behind it
- BFF proxy pattern (`apps/web/src/app/api/auth/[...path]/route.ts`) — browser → Next.js → Hono path for settings/notifications API calls
- shadcn/ui + `sonner` (toasts) + `nuqs` — notification center and settings UI primitives
- `date-fns` + `@date-fns/tz` (pinned) — Manila-hour bucketing for the cron handler. **No new dependencies required** (Resend SDK already approved/installed in Phase 1).

### Established Patterns

- Service factory style (`createEmailService`, reference `createNotificationService(db)`) — matches `services/` convention
- Drizzle schema single source of truth in `packages/db/src/schema.ts`; ISO-string dates with `$defaultFn`; migrations via Drizzle Kit (`/run-migrations`)
- Error shape `{ error: { code, message, details? } }`; Zod validation at route entry

### Integration Points

- `packages/db/src/schema.ts` — new `notifications` table (reference shape minus `businessId`, new type enum) + user settings storage (currency, reminder frequency/day/hour, enabled flag — column(s) on `users` or a settings table, planner's call) + pending-due dedup mechanism
- `apps/api/wrangler.toml` — add `[triggers] crons = ["0 * * * *"]` (hourly); Workers cron runs in **UTC**, so the handler converts to Manila time to find due users
- `apps/api/src/index.ts` — add the `scheduled` handler export alongside the existing `fetch` export; mount `/api/settings` and `/api/notifications` route groups behind `requireAuth`
- `apps/web/src/lib/` currency formatter (built in Phase 2/4) — starts reading the user's currency setting; no call-site changes
- Phase 2's `incomes` table (`moneyStatus = 'PENDING'`, `expectedReleaseDate`) — queried by the cron for the pending-due source
- Web UI: settings page + notification center surface in the app shell (header bell, coordinate with whatever shell Phases 2–5 establish)

</code_context>

<specifics>
## Specific Ideas

- This phase is the one place where "replicate the reference" only half-applies: keep the reference's notification **schema/service/route shapes**, but the notification types, all UI, the settings model, the cron, and the reminder email are Profitmuna-original — design them to feel native to the existing app
- The user deliberately chose flexibility over simplicity on scheduling (user-picked hour → hourly cron) but simplicity over cleverness on sending (always send, simple nudge email)
- Notification center exists to serve the Profit First flow: the pending-due source deep-links the user straight to marking income received — the core action that triggers allocation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 6-settings-notifications_
_Context gathered: 2026-06-06_
