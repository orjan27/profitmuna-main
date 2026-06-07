---
phase: 06-settings-notifications
plan: 03
subsystem: notifications
tags: [hono, drizzle, d1, nextjs, react, zod, ui, bff]

# Dependency graph
requires:
  - phase: 06-01
    provides: notifications table + indexes, Notification/NotificationType types, API envelope conventions
provides:
  - Notification service (list/getUnreadCount/markAsRead/markAllAsRead/create)
  - Notification Zod query schema (unreadOnly, limit 1..50)
  - Thin notifications router behind requireAuth, userId-scoped
  - BFF proxy for /api/notifications (GET + PUT)
  - NotificationBell + NotificationList client components
  - DashboardNav bell wired with SSR unread count + list
affects: [06-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service factory createNotificationService(db) with explicit return types, no `any`"
    - "IDOR-safe mutations: markAsRead WHERE eq(id) AND eq(userId)"
    - "Critical route order: PUT /read-all registered before PUT /:id/read"
    - "SSR fetch of nav data in layout Server Component, passed to Client Component nav as props"
    - "Optimistic UI update + router.refresh on mark-read / mark-all-read"

key-files:
  created:
    - apps/api/src/schemas/notifications.ts
    - apps/api/src/services/notification-service.ts
    - apps/api/src/routes/notifications.ts
    - apps/web/src/app/api/notifications/[...path]/route.ts
    - apps/web/src/components/notifications/NotificationBell.tsx
    - apps/web/src/components/notifications/NotificationList.tsx
  modified:
    - apps/api/src/index.ts
    - apps/web/src/app/(dashboard)/layout.tsx
    - apps/web/src/components/DashboardNav.tsx

key-decisions:
  - "create() lives on the service now so Plan 04's cron can produce notification rows through the same surface"
  - "Layout fetches list + unread-count in parallel with try/catch fallback (empty list / 0) so the dashboard shell never crashes if the endpoint is unavailable"
  - "Bell placed rightmost via ml-auto after ThemeToggle in the nav's third grid column"

patterns-established:
  - "IDOR mitigation: dual-predicate WHERE (id AND userId) on ownership-scoped mutations"
  - "Param-shadow avoidance: literal routes (/read-all) registered before param routes (/:id/read)"
  - "Server-fetched nav state passed as props into the Client Component nav (usePathname prevents server fetch there)"

requirements-completed: [NOTIF-01]

# Metrics
duration: ~30min
completed: 2026-06-07
---

# Phase 06 Plan 03: Notification Center Summary

**A complete UI→API→DB notification read/unread slice: a nav bell with an unread badge, a newest-first dropdown with unread highlighting, click-to-mark-read + deep-link, and mark-all-read — all behind requireAuth and userId-scoped.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-07
- **Tasks:** 3 completed
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- Notification service + thin router behind `requireAuth`, fully userId-scoped, with NOTIF-01 tests GREEN (4/4)
- NotificationBell + NotificationList components with optimistic mark-read / mark-all-read and deep-link navigation (D-08)
- Bell wired rightmost into DashboardNav, fed by SSR-fetched unread count + list from the (dashboard) layout
- `create()` exposed on the service so Plan 04's cron can produce notifications through the same surface

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification Zod schema + service + thin router (GREEN)** - `44ff79d` (feat)
2. **Task 2: BFF proxy + NotificationBell + NotificationList** - `db0c91d` (feat)
3. **Task 3: Wire NotificationBell into nav with SSR unread count + list** - `aa1aa04` (feat)

## Files Created/Modified
- `apps/api/src/schemas/notifications.ts` - Zod query schema: unreadOnly (coerced bool, default false), limit (int 1..50, default 50)
- `apps/api/src/services/notification-service.ts` - createNotificationService(db): list / getUnreadCount / markAsRead / markAllAsRead / create; explicit return types, no `any`
- `apps/api/src/routes/notifications.ts` - notificationsRouter behind requireAuth; GET / , GET /unread-count, PUT /read-all (before /:id/read), PUT /:id/read
- `apps/api/src/index.ts` - mounts `app.route('/api/notifications', notificationsRouter)`
- `apps/web/src/app/api/notifications/[...path]/route.ts` - BFF proxy forwarding to /api/notifications/ (GET + PUT only)
- `apps/web/src/components/notifications/NotificationBell.tsx` - ghost icon Button + Bell + destructive Badge (9+ cap), DropdownMenu hosting the list
- `apps/web/src/components/notifications/NotificationList.tsx` - newest-first rows, unread highlighting + dot, click marks read then navigates, mark-all-read, empty state + Settings footer
- `apps/web/src/app/(dashboard)/layout.tsx` - parallel SSR fetch of list + unread-count with try/catch fallback, passed to DashboardNav
- `apps/web/src/components/DashboardNav.tsx` - accepts unreadCount + notifications props, renders NotificationBell rightmost (ml-auto)

## Verification
- `npm run test --workspace=apps/api -- --run notification` — GREEN (4 passed)
- `npx tsc -b apps/api/tsconfig.json` — pass
- `npx tsc -b apps/web/tsconfig.json` — pass
- `npm run lint` — pass
- Manual (deferred per VALIDATION §Manual-Only): generate notifications via Plan 04 cron, open bell, verify unread styling + click marks read + navigates

## Threat Model Dispositions
- **T-6-06 (IDOR, markAsRead):** mitigated — WHERE includes both `eq(id)` and `eq(userId)`
- **T-6-07 (EoP, all endpoints):** mitigated — `.use('/*', requireAuth)` at router level
- **T-6-08 (Tampering, query params):** mitigated — zValidator bounds limit 1..50, coerces unreadOnly
- **T-6-09 (Info disclosure, list):** mitigated — list query scoped `eq(notifications.userId, userId)`
- **T-6-SC (npm installs):** accepted — no new dependencies

## Notes for Downstream
- Plan 04 (cron) is the producer: call `createNotificationService(db).create(userId, type, title, message, link?)` to insert notification rows. The Module Worker / cron-trigger change to `index.ts` is Plan 04's responsibility (this plan left `export default app`).
- The nav bell badge reflects the SSR-fetched count; client mutations call `router.refresh()` to re-pull it.
