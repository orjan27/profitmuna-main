---
phase: 01-authentication
plan: 03
subsystem: auth
tags: [password-reset, single-use-token, enumeration-safe, sha256, resend, hono, nextjs, tdd]

# Dependency graph
requires:
  - 01-01 (auth_tokens schema with reset_password purpose, generateSecureToken/sha256Hash, createEmailService.sendPasswordResetEmail, test harness)
  - 01-02 (login_attempts table for per-email cooldown, refreshTokens deletion pattern)
provides:
  - apps/api/src/schemas/auth.ts — forgotPasswordSchema + resetPasswordSchema
  - apps/api/src/services/auth-service.ts — forgotPassword() + resetPassword()
  - POST /api/auth/forgot-password (enumeration-safe, waitUntil email dispatch)
  - POST /api/auth/reset-password (single-use, 1h expiry, session wipe)
  - apps/web/src/components/auth/ForgotPasswordForm.tsx — email form, generic confirmation
  - apps/web/src/components/auth/ResetPasswordForm.tsx — password+confirm form, token prop
  - apps/web/src/app/(auth)/forgot-password/page.tsx
  - apps/web/src/app/(auth)/reset-password/page.tsx — token from searchParams, fallback for missing token
affects: [01-04 google-oauth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - sha256-hashed single-use reset token (D-09/D-10, T-03-01)
    - enumeration-safe forgot-password (always generic 200; exists flag drives email decision in route, never in response)
    - per-email reset cooldown via login_attempts table keyed __reset__<email> (T-03-03)
    - waitUntil for non-blocking reset email dispatch (Pattern 5)
    - post-reset full session wipe (DELETE all refresh_tokens for user, T-03-04)

key-files:
  created:
    - apps/web/src/components/auth/ForgotPasswordForm.tsx
    - apps/web/src/components/auth/ResetPasswordForm.tsx
    - apps/web/src/app/(auth)/forgot-password/page.tsx
    - apps/web/src/app/(auth)/reset-password/page.tsx
  modified:
    - apps/api/src/schemas/auth.ts
    - apps/api/src/services/auth-service.ts
    - apps/api/src/routes/auth.ts
    - apps/api/tests/auth.test.ts

key-decisions:
  - 'Per-email reset cooldown (5 min) reuses login_attempts table keyed by __reset__<email> rather than a separate table — avoids schema drift and directly satisfies security.md rate-limit on email-sending endpoints (T-03-03)'
  - 'forgotPassword returns { exists, resetUrl }; route (not service) decides whether to call sendPasswordResetEmail — preserves framework-agnostic service layer and keeps waitUntil outside the service (pattern established in slice 01)'
  - 'Cooldown returns exists:true with empty resetUrl during cooldown window — route skips email; prior token remains active for the full 1h'
  - 'reset-password page reads searchParams as a Promise (Next.js 15 async searchParams API)'

requirements-completed: [AUTH-04]

# Metrics
duration: ~30 min active
completed: 2026-06-06
---

# Phase 1 Plan 03: Password Reset Summary

**Single-use, 1-hour, sha256-hashed reset token flow: user requests reset by email, receives Resend-delivered link, sets a new password, and has all existing sessions revoked — enumeration-safe throughout.**

## Performance

- **Duration:** ~30 min active
- **Started:** 2026-06-06T08:50:00Z
- **Completed:** 2026-06-06T09:00:00Z
- **Tasks:** 2 (Task 1 TDD RED+GREEN, Task 2 routes+UI)
- **Files created/modified:** 8

## Accomplishments

- `forgotPassword()` service: per-email cooldown (login_attempts `__reset__<email>` key); deletes prior reset_password tokens; inserts sha256-hashed token (1h TTL); returns `{ exists, resetUrl }` so routes handle email dispatch with `waitUntil` — services stay framework-agnostic
- `resetPassword()` service: sha256 hash lookup; 400 on missing or expired token (T-03-01); updates `users.passwordHash`; DELETE token (single-use); DELETE all `refresh_tokens` for the user (T-03-04 force re-login)
- POST `/forgot-password`: `zValidator(forgotPasswordSchema)`; `waitUntil(sendPasswordResetEmail)` only when `exists && resetUrl`; always returns generic 200 `reset_requested` (T-03-02)
- POST `/reset-password`: `zValidator(resetPasswordSchema)` (min 8 password); delegates to `resetPassword`; returns 200; 400 propagates from service via `app.onError`
- `ForgotPasswordForm`: email input, POST `/api/auth/forgot-password`, after submit always shows "If an account with that address exists, a reset link has been sent" (enumeration-safe UI)
- `ResetPasswordForm`: `token` prop from page searchParams, password+confirm fields (min 8, must match), 200 → toast success + `router.push('/login')`, 400 → toast "link expired or invalid"
- `forgot-password/page.tsx` and `reset-password/page.tsx`: matching `(auth)` layout pattern; reset page falls back to "request new link" message when no token search param
- **53/53 tests green** including: issue, redeem, single-use reuse→400, expiry→400, generic response for unknown email, refresh-token wipe, route-level identical 200 for known/unknown emails, 400 for bad token, 422 for short password

## Task Commits

1. **Task 1 RED** — `ba94c77` — `test(01-03): add failing tests for forgotPassword/resetPassword (RED)`
2. **Task 1 GREEN** — `8f8da93` — `feat(01-03): implement forgotPassword/resetPassword service + schemas (GREEN)`
3. **Task 2** — `b345130` — `feat(01-03): forgot/reset routes + ForgotPasswordForm + ResetPasswordForm UI`

## Deviations from Plan

None — plan executed exactly as written.

All STRIDE mitigations implemented:

| T-ID    | Mitigation                                                                                |
| ------- | ----------------------------------------------------------------------------------------- |
| T-03-01 | sha256-hashed single-use token; DELETE on redemption; 1h expiry                           |
| T-03-02 | Always-generic 200 response; email only when user exists; identical UI confirmation       |
| T-03-03 | Per-email 5-min cooldown via login_attempts table (security.md: rate-limit email-sending) |
| T-03-04 | resetPassword deletes all refresh_tokens for the user (force re-login everywhere)         |
| T-03-05 | resetPasswordSchema enforces min 8; new hash via PBKDF2 (same scheme as registration)     |

## Known Stubs

None — the full reset flow is wired: browser form -> BFF -> API -> DB -> Resend (mock-asserted in tests).

## Threat Flags

No new threat surface introduced beyond the plan's `<threat_model>`. All T-03-01 through T-03-05 mitigations implemented as verified above.

## Self-Check: PASSED

- `apps/api/src/schemas/auth.ts` — contains `forgotPasswordSchema` and `resetPasswordSchema`
- `apps/api/src/services/auth-service.ts` — contains `export async function forgotPassword`, `export async function resetPassword`, and `reset_password`
- `apps/api/src/routes/auth.ts` — contains `authRouter.post('/forgot-password'`, `authRouter.post('/reset-password'`, and `waitUntil` sendPasswordResetEmail call
- `apps/web/src/components/auth/ResetPasswordForm.tsx` — contains `'use client'` and `fetch('/api/auth/reset-password'`
- `apps/web/src/app/(auth)/reset-password/page.tsx` — reads token search param via `await searchParams`
- `cd apps/api && npm test` → 53 passed
- `cd apps/api && npm run typecheck` → clean
- `cd apps/web && npm run typecheck && npm run lint` → clean
- All task commits verified: ba94c77, 8f8da93, b345130
