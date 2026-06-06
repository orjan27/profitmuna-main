---
phase: 01-authentication
plan: 02
subsystem: auth
tags:
  [
    jwt,
    session,
    refresh-rotation,
    reuse-detection,
    httponly-cookies,
    bff,
    nextjs-middleware,
    lockout,
    hono-middleware,
  ]

# Dependency graph
requires:
  - 01-01 (jwt/token/password libs, refresh_tokens schema, BFF proxy stub, login gate)
provides:
  - apps/api/src/services/auth-service.ts — login(), refreshTokens(), logout() (rotation + reuse-detection)
  - apps/api/src/middleware/auth.ts — requireAuth (iss/aud/exp/HS256 via verifyAccessToken)
  - POST /api/auth/login — 30m access + 7d refresh httpOnly cookies, 429 lockout
  - POST /api/auth/refresh — rotation with reuse-detection (chain-revoke on theft)
  - POST /api/auth/logout — global revocation + cookie clear
  - apps/web/src/app/api/auth/[...path]/route.ts — transparent BFF refresh (isTokenNearExpiry)
  - apps/web/src/server/auth.ts — getSession() for server-component UI gating
  - apps/web/src/middleware.ts — Next.js redirect guard for unauthenticated requests
  - apps/web/src/components/auth/LoginForm.tsx — login UI with 401/403/429 handling
  - apps/web/src/app/(auth)/login/page.tsx — login page
affects: [01-03 password-reset, 01-04 google-oauth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - opaque-refresh-token-in-DB (sha256 hash stored; raw token in cookie — enables rotation/reuse-detection)
    - per-request c.env secret reads in middleware (Workers binding is request-scoped)
    - silent BFF refresh via isTokenNearExpiry (base64 decode only; no signature verify)
    - login_attempts D1 counter with lockedUntil (non-atomic for v1; documented)

key-files:
  created:
    - apps/api/src/middleware/auth.ts
    - apps/web/src/server/auth.ts
    - apps/web/src/middleware.ts
    - apps/web/src/components/auth/LoginForm.tsx
    - apps/web/src/app/(auth)/login/page.tsx
  modified:
    - apps/api/src/services/auth-service.ts
    - apps/api/src/routes/auth.ts
    - apps/api/tests/auth.test.ts
    - apps/web/src/app/api/auth/[...path]/route.ts

key-decisions:
  - 'opaque refresh token in DB (not Jose 7d JWT) — sha256(raw) stored in refresh_tokens; enables rotation + reuse-detection per D-11'
  - 'requireAuth reuses verifyAccessToken from lib/jwt (enforces HS256 + iss + aud + exp); never calls jwtVerify directly with looser options'
  - 'global logout: delete all refresh_tokens rows for the user (D-12 log-out-everywhere)'
  - 'login_attempts non-atomic race documented for v1; lockedUntil ISO string in D1 login_attempts row'
  - 'BFF transparent refresh: isTokenNearExpiry decodes JWT exp without verifying; real verification is the API\''s job'
  - 'Google sign-in affordance rendered (href=/api/auth/google) in LoginForm; endpoint activates in slice 01-04'

requirements-completed: [AUTH-02, AUTH-05]

# Metrics
duration: ~35 min active
completed: 2026-06-06
---

# Phase 1 Plan 02: Login + Session Lifecycle Summary

**Login, session lifecycle, transparent BFF refresh, and rotation + reuse-detection: verified users log in via httpOnly cookies, stay signed in across 7 days via silent server-side token rotation, and log out with full server-side revocation.**

## Performance

- **Duration:** ~35 min active
- **Started:** 2026-06-06T08:07:00Z
- **Completed:** 2026-06-06T08:41:54Z
- **Tasks:** 3
- **Files created/modified:** 9

## Accomplishments

- `login()` service: lockout check → credential verify (constant-time PBKDF2) → email-verified gate → login_attempts reset → access JWT (30m) + opaque refresh token row (sha256 hash, 7d)
- `refreshTokens()`: rotation on every call; revoked-token reuse triggers full chain-revoke (T-02-01 theft mitigation); expired token → 401 without chain-revoke
- `logout()`: deletes all refresh_tokens rows for the user — global revocation (D-12)
- `requireAuth` middleware: reads `c.env.JWT_ACCESS_SECRET` per-request; delegates to `verifyAccessToken` so HS256 allowlist + iss/aud/exp are always validated (T-02-03)
- Routes `/login`, `/refresh`, `/logout`: httpOnly SameSite=Lax cookies (secure in production); 429 + Retry-After for lockout; requireAuth scoped to `/logout` only
- BFF `isTokenNearExpiry`: base64-decodes JWT exp (60s window) and does a server-to-server `/refresh` before forwarding; browser never sees a 401 from expiry
- `getSession()`: decodes access_token for server-component UI gating (no verification — API always verifies)
- Next.js middleware: redirects to `/login` when neither cookie present; matcher excludes api/\_next/static
- `LoginForm`: 401 → invalid credentials toast; 403 email_not_verified → resend prompt + resend button; 429 → lockout toast; Google sign-in affordance for slice 04
- **42/42 tests green** including: rotation, reuse-chain-revoke, expiry, lockout (5th attempt), logout idempotency, requireAuth iss/aud rejection

## Task Commits

1. **Task 1 RED** — `2353b09` — `test(01-02): add failing tests for login/refresh/logout/requireAuth (RED)`
2. **Task 1+2 GREEN** — `2975371` — `feat(01-02): implement login/refresh/logout service + requireAuth middleware (GREEN)`
3. **Task 3** — `1d8d9b3` — `feat(01-02): BFF transparent refresh, Next.js guard, login UI`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Name collision: exported function `refreshTokens` shadowed Drizzle table import `refreshTokens`**

- **Found during:** Task 1 GREEN (runtime — tests returned 500 with `delete from ? where = ?`)
- **Issue:** `import { refreshTokens } from '@app/db/schema'` was overwritten in scope by the exported async function `refreshTokens`, causing Drizzle to receive the function object as the table argument
- **Fix:** Renamed the schema import to `refreshTokensTable` throughout `auth-service.ts`
- **Files modified:** `apps/api/src/services/auth-service.ts`
- **Commit:** `2975371` (fixed in same GREEN commit)

No other deviations — plan executed as specified.

## Known Stubs

- `LoginForm` renders a Google sign-in `<a href="/api/auth/google">` link — the OAuth route does not exist yet (activates in slice 01-04). The link is intentional per the plan spec; it navigates to a 404 until slice 04 lands.

## Threat Flags

No new threat surface introduced beyond the plan's `<threat_model>`. All T-02-01 through T-02-07 mitigations implemented:

| T-ID    | Mitigation                                                                  |
| ------- | --------------------------------------------------------------------------- |
| T-02-01 | sha256 hash storage; rotation on every refresh; chain-revoke on reuse       |
| T-02-02 | 5-attempt lockout with 15-min lockedUntil; 429 + Retry-After                |
| T-02-03 | requireAuth delegates to verifyAccessToken (HS256 + iss + aud + exp)        |
| T-02-04 | httpOnly SameSite=Lax cookies; never in localStorage                        |
| T-02-05 | SameSite=Lax + same-origin BFF                                              |
| T-02-06 | Generic 401 invalid_credentials regardless of "no user" vs "wrong password" |
| T-02-07 | logout deletes all refresh_tokens rows + clears both cookies                |

## Self-Check: PASSED

- `apps/api/src/middleware/auth.ts` — exists, contains `createMiddleware` + `verifyAccessToken` + `c.env.JWT_ACCESS_SECRET` + `c.set('userId'`
- `apps/api/src/routes/auth.ts` — contains `authRouter.post('/refresh'` + `authRouter.post('/logout'` + `setCookie` + `deleteCookie` + `604800`
- `apps/web/src/app/api/auth/[...path]/route.ts` — contains `isTokenNearExpiry` + server-to-server `/api/auth/refresh` + `getSetCookie`
- `apps/web/src/middleware.ts` — contains `NextResponse.redirect` + `export const config` with matcher
- `apps/web/src/server/auth.ts` — contains `await cookies()` + `export async function getSession`
- `apps/web/src/components/auth/LoginForm.tsx` — contains `'use client'` + `fetch('/api/auth/login'` + `/api/auth/google`
- `cd apps/api && npm test` → 42 passed; `npm run typecheck` → clean
- `cd apps/web && npm run typecheck && npm run lint` → clean
- All task commits verified in git log
