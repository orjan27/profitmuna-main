---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 5 context gathered
last_updated: '2026-06-06T03:55:49.264Z'
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 15
  completed_plans: 9
  percent: 33
---

# State: Profitmuna

**Project:** Profitmuna
**Milestone:** v1
**Last updated:** 2026-06-06

---

## Project Reference

**Core value:** When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

**Current focus:** Phase 03 — profit-first-allocation

---

## Current Position

Phase: 03 (profit-first-allocation) — EXECUTING
Plan: 4 of 4
**Phase:** 03
**Plan:** Plan 04 complete — Phase 03 complete
**Status:** Executing Phase 03
**Phase goal:** Every user has exactly 4 Profit First allocation accounts; CRUD, percentage editing, and allocation summary with derived balances

```
Progress: [██████████] Phase 1 (4/4 automated) — Auth
           100% of Phase 1 automated plans complete; Task 3 live verification pending
```

---

## Performance Metrics

| Metric                | Value |
| --------------------- | ----- |
| Phases total          | 6     |
| Phases complete       | 0     |
| Requirements total    | 30    |
| Requirements complete | 2     |
| Plans complete        | 8     |

---

| Phase 01 P01 | 30 min active (7h57m wall) | 5 tasks | 35 files |
| Phase 01 P02 | 35 min active | 3 tasks | 9 files |
| Phase 01 P03 | 30 min | 2 tasks | 8 files |
| Phase 01 P04 | 20 min active | 4 commits | 4 files |
| Phase 03 P01 | ~15 min active | 3 tasks | 7 files |
| Phase 03 P02 | ~20 min active | 2 tasks | 6 files |
| Phase 03 P03 | ~30 min active | 2 tasks | 18 files |
| Phase 03 P04 | ~4 min active | 2 tasks | 5 files |

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

**Stopped at:** Phase 03 Plan 04 complete
**Next:** Phase 03 complete — proceed to Phase 04 (Wallets) or Phase 02 (Income & Expenses) per ROADMAP dependencies

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

- [Phase 01-03]: Per-email reset cooldown reuses login_attempts table (keyed **reset**<email>) — satisfies security.md rate-limit on email-sending without a new table
- [Phase 01-03]: forgotPassword returns {exists,resetUrl}; route handles waitUntil email dispatch — services stay framework-agnostic (pattern from slice 01)
- [Phase 01-03]: resetPassword deletes all refresh_tokens for user on password change — force re-login everywhere (T-03-04)
- [Phase 01-04]: upsertGoogleUser resolution order: googleId match → email match (link) → create new — no duplicates; Google email is provider-verified
- [Phase 01-04]: OAuth google + callback added to BFF UNAUTHED_PATHS — no session cookie during OAuth flow; transparent refresh must be skipped
- [Phase 03-01]: profitFirstAccounts uniqueIndex(userId, name) prevents duplicate seeding — constraint error on branch 1/2 calls is the intended guard
- [Phase 03-01]: incomes table was already present from Phase 2 work — minimal stub was not needed; Phase 3 queries use the full table
- [Phase 03-01]: PF_DEFAULT_COLORS canonical 8-value tuple in apps/web/src/lib/constants.ts; Plan 02 must duplicate in apps/api/src/schemas/profit-first.ts for Zod enum validation
- [Phase 03-02]: getSummary returns targetPercentage as percent (bp/100) not basis points — UI editor uses total===100 check (Pitfall 3)
- [Phase 03-02]: Phase 4 wallet-link guard in deleteAccount stubbed as comment block — wallets table does not exist in Phase 3
- [Phase 03-02]: BFF proxy has no transparent-refresh or Set-Cookie relay — middleware.ts handles auth redirect for unauthenticated users
- [Phase 03-03]: RSC page.tsx fetches direct to API_BASE_URL (not BFF proxy) — server-to-server avoids unnecessary hop; BFF reserved for client-side fetches and Plan 04 server actions
- [Phase 03-03]: PfContent is a thin client wrapper owning useAmountVisibility state; passes visible/mounted to PfOverview and AmountToggle — canonical RSC/client boundary composition pattern
- [Phase 03-03]: eslint.config.mjs updated with apps/\*\*/.next/ ignore — ESLint 9 flat config resolves ignores relative to config root, so workspace .next/ dirs require explicit glob prefixes
- [Phase 03-04]: Server actions in apps/web/src/server/ (not route-group \_actions/) per CLAUDE.md STRICT structure — mirrors auth.ts server-only module pattern
- [Phase 03-04]: percent→bp conversion (Math.round(pct \* 100)) done exclusively in server actions, never in UI components — Pitfall 3 containment
- [Phase 03-04]: Delete confirmation dialog mounted inside AccountCard (co-located with state) rather than lifted to PfContent — keeps delete state local to the card
- [Phase 03-04]: PfPercentageEditor mounted inline in PfContent replacing cards area — matches reference inline behavior; no Sheet/Drawer needed
