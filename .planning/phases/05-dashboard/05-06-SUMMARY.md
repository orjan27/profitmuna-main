---
phase: 05-dashboard
plan: 06
subsystem: routing
tags: [root-redirect, marketing-page, session-guard]
dependency_graph:
  requires: [01-02]
  provides: [authenticated-root-redirect]
  affects:
    - apps/web/src/app/page.tsx
tech_stack:
  added: []
  patterns:
    - getSession() guard in an RSC page; redirect('/overview') for signed-in users
key_files:
  created: []
  modified:
    - apps/web/src/app/page.tsx
requirements: [DASH-01]
status: complete
commits: [ee98706]
executed: 2026-06-07
executor: direct (user opted out of GSD executor for this phase)
---

# Summary: Root Landing Redirect

`Home()` is now async: `const session = await getSession(); if (session)
redirect('/overview');`. Marketing markup unchanged for signed-out visitors.
`middleware.ts` untouched — `/` remains a PUBLIC_ROUTE; the guard lives only
in the page (D-10, accepted deviation: target is `/overview`, not `/dashboard`).

## Verification

- E2E: visiting `/` while logged in lands on `/overview`; logged-out curl
  to `/` returns the marketing page (200).
