---
phase: 01-authentication
plan: 01
subsystem: auth
tags: [jwt, jose, pbkdf2, resend, hono, drizzle, d1, bff, nextjs, security-headers]

# Dependency graph
requires: []
provides:
  - Live D1 schema: users (extended), refresh_tokens, auth_tokens, login_attempts
  - apps/api/src/lib/jwt.ts — sign/verify with iss profitmuna + aud profitmuna-api (HS256)
  - apps/api/src/lib/password.ts — PBKDF2-SHA256 210k hash/verify
  - apps/api/src/lib/token.ts — generateSecureToken, sha256Hash, encodeHex
  - apps/api/src/lib/email.ts — createEmailService (verification, welcome, reset)
  - apps/api/src/middleware/security-headers.ts — security headers on every API response
  - apps/api/src/types/index.ts — Bindings + Variables
  - POST /api/auth/register, /verify-email, /resend-verification, /login (gate only)
  - BFF catch-all proxy apps/web/src/app/api/auth/[...path]/route.ts with Set-Cookie relay
  - Register + verify-email pages, RegisterForm, shadcn primitives (button/input/label/card)
  - In-memory D1 test shim (apps/api/tests/helpers/db.ts) + 23 green tests
affects: [01-02 login/session, 01-03 password-reset, 01-04 google-oauth]

# Tech tracking
tech-stack:
  added: [resend@6.12.4, arctic@3.7.0, radix-ui (shadcn CLI peer)]
  patterns:
    [
      thin-routes/services-split,
      framework-agnostic services returning data for waitUntil email dispatch,
      hashed single-use DB tokens,
      BFF same-origin proxy,
    ]

key-files:
  created:
    - apps/api/src/types/index.ts
    - apps/api/src/lib/jwt.ts
    - apps/api/src/lib/token.ts
    - apps/api/src/lib/password.ts
    - apps/api/src/lib/email.ts
    - apps/api/src/middleware/security-headers.ts
    - apps/api/src/schemas/auth.ts
    - apps/api/src/services/auth-service.ts
    - apps/api/src/routes/auth.ts
    - apps/api/tests/helpers/db.ts
    - apps/api/tests/auth.test.ts
    - apps/web/src/app/api/auth/[...path]/route.ts
    - apps/web/src/components/auth/RegisterForm.tsx
    - apps/web/src/app/(auth)/register/page.tsx
    - apps/web/src/app/(auth)/verify-email/page.tsx
    - apps/web/src/app/(auth)/verify-email/VerifyEmailStatus.tsx
    - packages/db/migrations/0000_sleepy_machine_man.sql
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/index.ts
    - apps/api/wrangler.toml
    - apps/api/tsconfig.json
    - apps/api/vitest.config.ts
    - apps/web/next.config.ts
    - apps/web/src/app/layout.tsx
    - .env.example
    - packages/db/tsconfig.json

key-decisions:
  - 'PBKDF2-SHA256 210k iterations via Web Crypto instead of bcryptjs (Workers-native, zero CPU-timeout risk) — documented deviation from security.md bcrypt-cost-12 literal'
  - 'JWT access lifetime 30m per locked ROADMAP decision (security.md says 15m max — compensating control: refresh rotation in slice 02)'
  - 'Services return verifyUrl/email data; routes schedule emails via waitUntil — keeps services framework-agnostic and responses non-blocking'
  - 'Generic 201 register response regardless of email existence (enumeration mitigation)'
  - 'Login route returns 501 not_implemented after the D-07 gate passes — session issuance lands in slice 02'

patterns-established:
  - 'Error shape: app.onError maps HTTPException message to { error: { code, message } }'
  - 'Validation: zValidator hooks return 422 (default 400 overridden per security.md)'
  - 'Tests: in-memory better-sqlite3 D1 shim + mockEnv() + executionCtx stub for waitUntil'
  - 'Raw token in email link, sha256 hash in DB, single-use DELETE on redemption'

requirements-completed: [AUTH-01, AUTH-06]

# Metrics
duration: 7h 57m (incl. ~7.5h provider-outage wait; active execution ~30 min)
completed: 2026-06-06
---

# Phase 1 Plan 01: Walking Skeleton + Registration Summary

**Full register → verify-email → login-gate vertical slice: browser form → Next.js BFF → Hono Workers API → D1 → Resend, with PBKDF2 passwords, iss/aud-validated JWTs, hashed single-use tokens, and security headers on every response.**

## Performance

- **Duration:** 7h 57m wall clock (≈30 min active; ~7.5h waiting out an Anthropic API outage)
- **Started:** 2026-06-05T16:06:07Z
- **Completed:** 2026-06-06T00:03:32Z
- **Tasks:** 5 (incl. Task 0 checkpoint)
- **Files modified:** 35+

## Accomplishments

- Entire auth foundation scaffolded: D1 schema (4 tables), jwt/token/password/email primitives, Bindings types, test harness
- Registration slice proven end-to-end: 201 + unverified user row + hashed 24h verify token + verification & welcome emails (mock-asserted, waitUntil-dispatched)
- Verification link consumption is single-use (DELETE on redemption; reuse → 400; expiry honored)
- Login hard-blocked for unverified users: 403 `email_not_verified`, no cookies (D-07 invariant)
- security.md header set on every API response (Hono middleware) and every web response (next.config headers()); HSTS in production
- Local D1 migrated — live database has users/refresh_tokens/auth_tokens/login_attempts
- 23 green Vitest tests incl. iss/aud validation, enumeration mitigation, token reuse/expiry, headers

## Task Commits

1. **Task 0: Package legitimacy checkpoint** — approved by user (resend@6.12.4, arctic@3.7.0 verified against npm registry)
2. **Task 1: Scaffold (schema, libs, types, harness)** - `1356d72` (feat)
3. **Task 2: Registration + verification slice + security headers** - `7df1ddc` (feat)
4. **Task 3: BFF proxy + register/verify UI + web headers** - `5cd8e04` (feat)
5. **Task 4: Drizzle migration generate + local D1 apply** - `3d84fa8` (feat)
6. **Deviation fix: packages/db D1Database typecheck** - `3dcd031` (fix)

## Files Created/Modified

See key-files frontmatter. Highlights:

- `packages/db/src/schema.ts` - users extended (password_hash, email_verified, verified_at, google_id); refresh_tokens, auth_tokens, login_attempts added
- `apps/api/src/services/auth-service.ts` - register, verifyEmail, resendVerification, assertLoginAllowed
- `apps/web/src/app/api/auth/[...path]/route.ts` - BFF proxy with Bearer forward + Set-Cookie append() relay

## Decisions Made

- PBKDF2 (not bcryptjs) — Workers-native; format `pbkdf2$sha256$210000$<saltHex>$<hashHex>` with constant-time compare
- Two separate emails (verification + welcome) — independently testable (AUTH-06)
- Services stay email-free: they return `{ verifyUrl, email, name }`; routes wire `createEmailService` + `waitUntil` (minor deviation from the plan's literal service signatures, same behavior, cleaner layering)

## Deviations from Plan

- **[Rule 1 - Bug] Pre-existing packages/db typecheck failure** — Found during: plan verification | `createDb(d1: D1Database)` never typechecked (no workers-types) | Fix: `types: ["@cloudflare/workers-types"]` in packages/db/tsconfig.json (dep already in workspace) | Files: packages/db/tsconfig.json | Verified: `tsc --noEmit` exits 0 | Commit: `3dcd031`
- **[Rule 2 - Missing critical] Toaster not mounted** — Found during: Task 3 | sonner `toast()` calls are no-ops without `<Toaster />` | Fix: mounted `<Toaster richColors />` in root layout | Files: apps/web/src/app/layout.tsx | Verified: typecheck + lint green | Commit: `5cd8e04`
- **[Rule 3 - Blocker] tsconfig/vitest aliases for @app/db** — Found during: Tasks 1–2 | apps/api `paths` override dropped `@app/db`; vitest had no workspace alias | Fix: added paths to apps/api/tsconfig.json + vitest.config.ts aliases | Commits: `1356d72`, `7df1ddc`
- **[Planned deviation] PBKDF2 instead of bcrypt cost-12** — per plan decisions_resolved (T-01-04)
- **[Planned deviation] 30m access token vs security.md 15m** — locked ROADMAP decision

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocker) + 2 pre-documented. **Impact:** none on plan scope; all gates green.

## Issues Encountered

- Anthropic API outage (529 Overloaded on all subagent spawns, ~7.5h) — orchestrator switched to inline execution per workflow fallback; no functional impact
- Pre-existing `vitest <4.1.0` critical npm-audit advisory (GHSA-5xrq-8626-4rwp, dev-only Vitest UI server) — NOT introduced by this plan; major-version bump deferred for user approval

## Authentication Gates

- Production D1 apply deferred: placeholder `database_id = "local"` + no Cloudflare auth in this environment. Documented in 01-USER-SETUP.md (deploy-time human action: `wrangler login`, real database_id, `--remote` apply)

## User Setup Required

`01-USER-SETUP.md` created — RESEND_API_KEY, JWT secrets, Resend sender domain, production D1 apply.

## Self-Check: PASSED

- All key-files verified on disk
- `git log --grep="01-01"` returns 5 commits
- `cd apps/api && npm test` → 23 passed; api/web/db typecheck + web lint → clean
- Acceptance criteria re-run per task — all PASS (see task sections)

## Next Phase Readiness

- Ready for 01-02 (login + session lifecycle): jwt/token libs, refresh_tokens table, BFF relay, and the login gate are all in place
- Live email delivery untestable until RESEND_API_KEY is provided (mock-asserted in tests)
