---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-06T00:05:00.764Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
  percent: 0
---

# State: Profitmuna

**Project:** Profitmuna
**Milestone:** v1
**Last updated:** 2026-06-05

---

## Project Reference

**Core value:** When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

**Current focus:** Phase 01 — authentication

---

## Current Position

Phase: 01 (authentication) — EXECUTING
Plan: 1 of 4
**Phase:** 1 — Authentication
**Plan:** None started
**Status:** Executing Phase 01
**Phase goal:** Users can securely create accounts and log in via email/password or Google, with email verification and password recovery

```
Progress: [ ] Phase 1  [ ] Phase 2  [ ] Phase 3  [ ] Phase 4  [ ] Phase 5  [ ] Phase 6
           Auth         Inc+Exp      PF Alloc     Wallets      Dashboard    Settings
```

---

## Performance Metrics

| Metric                | Value |
| --------------------- | ----- |
| Phases total          | 6     |
| Phases complete       | 0     |
| Requirements total    | 30    |
| Requirements complete | 0     |
| Plans complete        | 0     |

---
| Phase 01 P01 | 30 min active (7h57m wall) | 5 tasks | 35 files |

## Accumulated Context

### Key Decisions

| Decision                                                                  | Rationale                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Money stored as integer cents                                             | Avoids floating-point errors; matches reference implementation                                              |
| Percentages stored as basis points (e.g. 500 = 5.00%)                     | Matches reference; integer math for allocation                                                              |
| Allocation and wallet balances are derived, not stored                    | Percentage changes retroactively recompute; simpler schema                                                  |
| JWT 30-min access / 7-day refresh in httpOnly cookies                     | User-specified security standard                                                                            |
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

**To resume work:** Read ROADMAP.md for phase goals and success criteria, then run `/gsd:plan-phase 1` to begin Phase 1 planning.

**Phase 1 key files to create:**

- `packages/db/src/schema.ts` — users, sessions, email_verifications, password_resets tables
- `apps/api/src/routes/auth.ts` — register, login, logout, refresh, verify-email, reset-password, google-oauth
- `apps/api/src/services/authService.ts` — JWT signing/verification, password hashing, email dispatch
- `apps/api/src/middleware/auth.ts` — JWT validation middleware
- `apps/web/src/app/(auth)/` — register, login, verify-email, reset-password pages
- `apps/web/src/server/` — server actions or fetch wrappers for auth API calls

---

_State initialized: 2026-06-05_
