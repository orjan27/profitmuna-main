---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 5 complete — verified 10/10 and merged to master
last_updated: '2026-06-07T06:00:00.000Z'
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 28
  completed_plans: 21
  percent: 75
---

# State: Profitmuna

**Project:** Profitmuna
**Milestone:** v1
**Last updated:** 2026-06-06

---

## Project Reference

**Core value:** When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

**Current focus:** Phase 06 — settings & notifications (next up)

---

## Current Position

Phase: 05 (dashboard) — COMPLETE (2026-06-07, re-verification 10/10, DASH-01 closed)
**Phase:** 06 next
**Plan:** Not started
**Status:** Phase 05 complete and merged to master; Phase 06 UI-SPEC already approved
**Phase 05 goal (met):** Users land on a summary page that surfaces the most important financial information without navigating to individual sections

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
| Phase 03 P05 | ~8 min active | 2 tasks | 2 files |
| Phase 03 P06 | ~10 min active | 2 tasks | 4 files |
| Phase 04 P01 | ~6 min active | 3 tasks | 10 files |
| Phase 04 P02 | 12 | 4 tasks | 10 files |
| Phase 04 P03 | 12 | 3 tasks | 7 files |
| Phase 04 P04-04 | 15 min | 2 tasks | 5 files |

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

### Quick Tasks Completed

| #          | Description                                                                                                                                                                                                                                                  | Date       | Commit  | Directory                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 260606-tln | Shared navbar in (dashboard) shell; moved /income + /expenses into route group; ROADMAP Phase 5 nav-shell criterion added                                                                                                                                    | 2026-06-06 | 14fb3e6 | [260606-tln-add-shared-navbar-to-authenticated-app-s](./quick/260606-tln-add-shared-navbar-to-authenticated-app-s/) |
| 260607-hci | Removed redundant wallets.sourceType enum — profitFirstAccountId nullability is now the sole PF discriminator (DB migration 0004, API re-key, web type-picker → optional allocation selector)                                                                | 2026-06-07 | e3cea15 | [260607-hci-remove-wallet-sourcetype-enum](./quick/260607-hci-remove-wallet-sourcetype-enum/)                       |
| 260607-iib | Fixed dark mode toggle floating mid-bar on mobile — pinned ThemeToggle wrapper to trailing grid track (`col-start-3`) in DashboardNav                                                                                                                        | 2026-06-07 | 23c491c | [260607-iib-fix-dark-mode-toggle-position-in-mobile-](./quick/260607-iib-fix-dark-mode-toggle-position-in-mobile-/) |
| 260607-iy4 | BrandMark now renders the original full ProfitMuna logo (`/profitmuna-logo.webp`) as-is — removed cropped glyph + typeset "Profitmuna" text, dropped `withWordmark`/`wordmarkClassName` props, resized 7 call sites, deleted orphaned `profitmuna-mark.webp` | 2026-06-07 | c4c2b20 | [260607-iy4-use-original-full-profitmuna-logo-in-bra](./quick/260607-iy4-use-original-full-profitmuna-logo-in-bra/) |
| 260607-izx | Mobile Wallets page: inline "New wallet" button hidden on mobile (`max-md:hidden`), new WalletFab (Wallet icon + Plus badge, RecordFab placement/styling) links to /wallets/new                                                                              | 2026-06-07 | ebe9e6c | [260607-izx-remove-wallet-new-button-add-wallet-fab](./quick/260607-izx-remove-wallet-new-button-add-wallet-fab/)   |

---

## Session Continuity

**Stopped at:** Phase 5 complete — gap-closure plans 05-04/05-05/05-06 executed directly (user opted out of GSD executor), re-verified 10/10, merged to master
**Next:** Phase 06 — settings & notifications (UI-SPEC already approved)

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
- [Phase 03-05]: updatePercentages coverage check runs before sum validation and before any DB writes — rejection is atomic; no partial updates on invalid payload
- [Phase 03-05]: Error message 'Submit all accounts exactly once.' is generic — reveals no owned-ID data or internal state (T-03-05-03 accept disposition)
- [Phase 03-06]: Category list in getSummary is intentionally unfiltered — must show all options regardless of active date/categoryIds filter so users can see and select any category
- [Phase 03-06]: Category ids mapped to strings in page.tsx (String(c.id)) to match nuqs parseAsArrayOf(parseAsString) contract — avoids type mismatch in URL param handling
- [Phase 03-06]: Empty-state uses disabled button + muted text rather than hiding the filter control — visible non-interactive indicator is better UX than invisible dead filter
- [Phase 04-01]: wallets_user_pf_account_unique index on (userId, profitFirstAccountId) enforces one wallet per PF account at DB level (WAL-01 D-01)
- [Phase 04-01]: profitFirstAccountId FK has no onDelete cascade — wallet delete-guard in Plan 02 service can block deletes of linked PF accounts (D-16)
- [Phase 04-01]: (dashboard)/layout.tsx already existed from Phase 3 — left unchanged; wallet pages will nest inside it automatically
- [Phase 04-01]: walletsRouter uses self-contained requireAuth at router level, matching profitFirstRouter pattern — no outer app.use needed (T-04-01)
- [Phase 04-02]: walletBaseSchema extracted from createWalletSchema so updateWalletSchema can use .partial() — Zod v4 disallows .partial() on refined schemas
- [Phase 04-02]: GET /api/profit-first/summary used for PF accounts (no standalone GET /accounts endpoint); accounts in summary.data.accounts
- [Phase 04-02]: Edit dropdown in WalletCard navigates to /wallets/{id} detail page (D-05); no separate /edit route created in Phase 4
- [Phase 04-02]: setIncomeCategoryMappings/setExpenseMappings implemented in Task 1a factory alongside create/update; WAL-02 tests were green on first run (plan-authorized ordering)
- [Phase 04-03]: assertCanInsertTransaction module-level, pure (no DB), runs before insert — double-count guard (T-04-12)
- [Phase 04-03]: getById balance queries exclude deletedAt; history queries include deletedAt — Pitfall 4 distinct queries
- [Phase 04-03]: WalletDetail blocking uses breakdown cents as conservative proxy; server enforces assertCanInsertTransaction regardless
- [Phase 04-04]: Per-source COUNT(\*) queries are independent of fetchLimit window so totalPages is never understated by the windowed fetch cap
- [Phase 04-04]: inArray replaces per-category for-loops for both income and expense history — eliminates N+1 queries and duplicate rows in autoDeductAllExpenses path
- [Phase 04-04]: walletIdParamSchema + txIdParamSchema use z.coerce.number().int().positive() mirroring walletTransactionQuerySchema style; coerce handles string-typed path params from Hono
- [Phase 04-04]: isRedirectError from next/dist/client/components/redirect-error is the stable Next.js 15 guard for distinguishing redirect throws from real errors in server action catch blocks
