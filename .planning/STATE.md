---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed Phase 01 Plan 02 (login + session lifecycle)
last_updated: '2026-06-06T00:58:16.231Z'
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 0
---

# State: Profitmuna

**Project:** Profitmuna
**Milestone:** v1
**Last updated:** 2026-06-06

---

## Project Reference

**Core value:** When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

**Current focus:** Phase 01 — authentication

---

## Current Position

Phase: 01 (authentication) — EXECUTING
Plan: 2 of 4 (COMPLETED) — next: 01-03 password reset
**Phase:** 1 — Authentication
**Plan:** 01-02 complete — login/session lifecycle
**Status:** Executing Phase 01
**Phase goal:** Users can securely create accounts and log in via email/password or Google, with email verification and password recovery

```
Progress: [█████░░░░░] Phase 1 (2/4) — Auth
           50% of Phase 1 plans complete
```

---

## Performance Metrics

| Metric                | Value |
| --------------------- | ----- |
| Phases total          | 6     |
| Phases complete       | 0     |
| Requirements total    | 30    |
| Requirements complete | 2     |
| Plans complete        | 2     |

---

| Phase 01 P01 | 30 min active (7h57m wall) | 5 tasks | 35 files |
| Phase 01 P02 | 35 min active | 3 tasks | 9 files |
| Phase 01 P03 | 30 min | 2 tasks | 8 files |

## Accumulated Context

### Key Decisions

| Decision                                                                  | Rationale                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Money stored as integer cents                                             | Avoids floating-point errors; matches reference implementation                                              |
| Percentages stored as basis points (e.g. 500 = 5.00%)                     | Matches reference; integer math for allocation                                                              |
| Allocation and wallet balances are derived, not stored                    | Percentage changes retroactively recompute; simpler schema                                                  |
| JWT 30-min access / 7-day refresh in httpOnly cookies                     | User-specified security standard                                                                            |
| Opaque refresh token in DB (sha256 hash); not a long-lived JWT            | Enables rotation + reuse-detection (D-11); revoked tokens detectable                                        |
| requireAuth reuses verifyAccessToken from lib/jwt                         | Enforces HS256 + iss + aud + exp on every request without re-implementing (T-02-03)                         |
| Global logout deletes all refresh_tokens rows for user                    | Log-out-everywhere semantics per D-12                                                                       |
| login_attempts lockout: 5 failures → 15-min lockedUntil (non-atomic v1)   | Brute-force mitigation T-02-02; non-atomic race documented and accepted for v1                              |
| Resend for all email (verification, reset, welcome, reminders)            | User-specified provider; net-new (reference has no email)                                                   |
| Scheduled reminder emails via Workers cron                                | Matches edge runtime constraint; no Node.js cron                                                            |
| Income/expense categories have system defaults (protected) + user customs | Matches reference mechanics                                                                                 |
| Phase 6 depends on Phase 1 only                                           | Settings and notifications are utility features; do not require income/expense/allocation data to implement |

### Architecture Notes

- Brownfield scaffold: monorepo with Next.js 15 web, Hono 4.12.9 API on Cloudflare Workers, Drizzle 0.45.2/D1
- All DB access via API layer only (no direct DB from Next.js)
- Route handlers stay thin — business logic in `apps/api/src/services/`
- Zod validation in `apps/api/src/schemas/` per resource
- `jose` package already pinned but unused — use for JWT implementation
- Resend SDK will need user approval before adding as dependency

### Todos

- [ ] Get user approval to add Resend SDK dependency before Phase 1 implementation
- [ ] Confirm Google OAuth client ID/secret configuration approach (wrangler secrets)

### Blockers

None currently.

---

## Session Continuity

**Stopped at:** Completed Phase 01 Plan 03 (password reset)
**Next:** Execute Phase 01 Plan 04 — Google OAuth

**Phase 1 completed files (Plans 01-02):**

- `apps/api/src/services/auth-service.ts` — register, verifyEmail, resendVerification, assertLoginAllowed, login, refreshTokens, logout
- `apps/api/src/routes/auth.ts` — POST register/verify-email/resend-verification/login/refresh/logout
- `apps/api/src/middleware/auth.ts` — requireAuth (iss/aud/exp validated via verifyAccessToken)
- `apps/web/src/app/api/auth/[...path]/route.ts` — BFF proxy with transparent refresh
- `apps/web/src/server/auth.ts` — getSession() for server components
- `apps/web/src/middleware.ts` — redirect guard to /login
- `apps/web/src/components/auth/RegisterForm.tsx`, `LoginForm.tsx`
- `apps/web/src/app/(auth)/register/`, `login/`, `verify-email/` pages

---

_State initialized: 2026-06-05_

## Decisions

- [Phase ?]: Per-email reset cooldown reuses login_attempts table (keyed **reset**<email>) — satisfies security.md rate-limit on email-sending without a new table
- [Phase ?]: forgotPassword returns {exists,resetUrl}; route handles waitUntil email dispatch — services stay framework-agnostic (pattern from slice 01)
- [Phase ?]: resetPassword deletes all refresh_tokens for user on password change — force re-login everywhere (T-03-04)
