---
phase: 01-authentication
plan: 04
subsystem: auth
tags: [google-oauth, arctic, pkce, csrf, account-linking, httponly-cookies, hono, tdd]

# Dependency graph
requires:
  - 01-02 (login session issuance, httpOnly cookie machinery, refreshTokens table)
  - arctic@3.7.0 (legitimacy-gated in 01-01 Task 0)
provides:
  - apps/api/src/services/auth-service.ts — upsertGoogleUser account-linking logic
  - apps/api/src/routes/auth.ts — GET /api/auth/google (PKCE initiation), GET /api/auth/google/callback
  - apps/web/src/app/api/auth/[...path]/route.ts — google + callback added to UNAUTHED_PATHS
affects: [future protected routes, session lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - arctic PKCE flow (generateState + generateCodeVerifier + createAuthorizationURL + validateAuthorizationCode)
    - OAuth state/verifier as httpOnly SameSite=Lax short-lived cookies (T-04-01/T-04-04)
    - Account-linking by email (Google email is provider-verified; upsert by googleId, then email, then create)
    - Fixed redirect target — APP_BASE_URL + '/' only, never user-supplied URL (T-04-02)
    - Google access token used transiently for userinfo, never stored (T-04-05)

key-files:
  created: []
  modified:
    - apps/api/src/services/auth-service.ts
    - apps/api/src/routes/auth.ts
    - apps/api/tests/auth.test.ts
    - apps/web/src/app/api/auth/[...path]/route.ts

key-decisions:
  - 'upsertGoogleUser resolution order: googleId match (returning) → email match (link) → create new; no duplicates'
  - 'Session issuance in callback uses signAccessToken + direct DB insert (same pattern as login()), not a shared helper — avoids over-abstraction while reusing the same flow'
  - 'google + callback added to BFF UNAUTHED_PATHS: OAuth flow has no session cookie; transparent refresh must be skipped on initiation and callback'
  - 'Static imports for @app/db and @app/db/schema in route handler — dynamic import() is an anti-pattern avoided per CLAUDE.md'

requirements-completed: [AUTH-03]

# Metrics
duration: ~20 min active
completed: 2026-06-06
---

# Phase 1 Plan 04: Google OAuth Summary

**Arctic-based PKCE OAuth: first login auto-creates a verified account, returning Google user signs in directly, and a Google login matching an existing password account links the identities by email — callback issues the same httpOnly access+refresh session as password login.**

## Performance

- **Duration:** ~20 min active
- **Started:** 2026-06-06T09:00:00Z
- **Completed:** 2026-06-06T09:06:00Z (all automatable work complete); Task 3 live verification deferred to UAT
- **Tasks:** 3 of 3 — Tasks 1 & 2 automated and complete; Task 3 automatable portion (login-page Google link) complete, live OAuth verification DEFERRED to UAT (not failed)
- **Files created/modified:** 4

## Accomplishments

- `upsertGoogleUser(d1, {sub, email, name})`: three-branch lookup — returning by googleId, link by email, create new; Google-only users get `emailVerified=true`, `passwordHash=null`
- GET `/api/auth/google`: `arctic.Google` PKCE initiation; `oauth_state` + `oauth_code_verifier` as `httpOnly SameSite=Lax maxAge=600` cookies (T-04-01 CSRF guard, T-04-04 PKCE)
- GET `/api/auth/google/callback`: state equality check (400 `invalid_oauth_state` on mismatch); `validateAuthorizationCode` PKCE exchange; userinfo fetch; `upsertGoogleUser`; session issuance (access JWT 30m + refresh token 7d, same cookie attrs as `login()`); state/verifier cookies cleared; fixed `APP_BASE_URL + '/'` redirect (T-04-02 open-redirect guard)
- BFF `UNAUTHED_PATHS`: `google` + `callback` added — OAuth flow arrives with no session cookie; transparent refresh must be skipped
- **62/62 tests green** including: `upsertGoogleUser` all three branches; callback state mismatch → 400; missing code → 400; missing verifier → 400; valid callback (mocked Google) → session cookies set + redirect + DB row created + refresh token row inserted

## Task Commits

1. **Task 1 RED** — `c97c809` — `test(01-04): add failing tests for upsertGoogleUser (RED)`
2. **Task 1 GREEN** — `6c5f9bd` — `feat(01-04): implement upsertGoogleUser account-linking logic (GREEN)`
3. **Task 2** — `be24d45` — `feat(01-04): add GET /google authorize and GET /google/callback routes`
4. **BFF fix** — `c964f0a` — `fix(01-04): add google + callback to BFF UNAUTHED_PATHS`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added google + callback to BFF UNAUTHED_PATHS**

- **Found during:** Task 2 review of BFF proxy
- **Issue:** The BFF `proxy()` function performs a transparent refresh on every request not in `UNAUTHED_PATHS`. OAuth initiation and callback arrive with no session cookie — the transparent refresh would run unnecessarily (querying the API for a non-existent refresh token on every OAuth request).
- **Fix:** Added `'google'` and `'callback'` to `UNAUTHED_PATHS` in `apps/web/src/app/api/auth/[...path]/route.ts`.
- **Files modified:** `apps/web/src/app/api/auth/[...path]/route.ts`
- **Commit:** `c964f0a`

**2. [Rule 1 - Bug] Removed unused `or` import from auth-service.ts**

- **Found during:** Task 1 implementation
- **Issue:** Initially added `import { or } from 'drizzle-orm'` as a duplicate import (drizzle-orm already imported on line 2); `or` was not used in the final implementation.
- **Fix:** Removed the extra import before committing.
- **Files modified:** `apps/api/src/services/auth-service.ts`

**3. [Rule 3 - Blocking issue] Replaced dynamic `import()` with static imports in route handler**

- **Found during:** Task 2 code review
- **Issue:** Initial implementation used `await import('@app/db')` and `await import('@app/db/schema')` inside the handler body — anti-pattern per CLAUDE.md and Workers edge runtime best practice (avoids dynamic resolution on every request).
- **Fix:** Moved `createDb` and `refreshTokens` table to static top-level imports.
- **Files modified:** `apps/api/src/routes/auth.ts`

## Human Verification Required

Task 3 (live Google OAuth end-to-end) is a `checkpoint:human-verify` gate. **All automatable work is
complete** — the login-page "Sign in with Google" affordance is a top-level `<a href="/api/auth/google">`
navigation (confirmed in `apps/web/src/components/auth/LoginForm.tsx` lines 141-146, the correct shape so
the OAuth redirect chain works), and the BFF catch-all proxies the `/api/auth/google` + callback paths.
The live consent flow cannot be unit-tested (it needs the real Google consent screen), so it is **DEFERRED
to UAT — not failed**. It is gated on human credential setup, not on a code stub.

See `.planning/phases/01-authentication/01-USER-SETUP.md` (Google OAuth section) for the env vars
(`GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`), the `GOOGLE_CLIENT_SECRET` secret, and the Google Cloud
Console redirect-URI configuration.

Exact verification steps (from the Task 3 checkpoint):

1. Set `GOOGLE_CLIENT_ID` + `GOOGLE_REDIRECT_URI` in `apps/api/wrangler.toml [vars]`; set the secret with `wrangler secret put GOOGLE_CLIENT_SECRET` (or `apps/api/.dev.vars` for dev).
2. In Google Cloud Console, add the exact redirect URI (e.g. `http://localhost:8793/api/auth/google/callback`) to **Authorized redirect URIs**.
3. Run the API (`npm run dev` in `apps/api`) and web (`npm run dev` in `apps/web`).
4. Visit the login page, click **Sign in with Google**, complete consent.
5. Confirm you land back signed in (access + refresh cookies set) and a `users` row exists with `google_id` set and `email_verified=true`.
6. Repeat with an email that already had a password account and confirm it **LINKS** (same row gets `google_id`) rather than creating a duplicate.

## Known Stubs

None — automated slice is fully wired. The login-page Google link is live. Task 3 live verification is
deferred to UAT and gated on human credential setup (not a code stub).

## STRIDE Mitigations Implemented

| T-ID    | Mitigation                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------- |
| T-04-01 | arctic state generated + stored as httpOnly Lax cookie; callback rejects state mismatch (400)           |
| T-04-02 | Redirect only to fixed `APP_BASE_URL + '/'`; never to a user-supplied URL                               |
| T-04-03 | Link only on exact email match; Google email is provider-verified; emailVerified=true only via Google   |
| T-04-04 | arctic generateCodeVerifier + validateAuthorizationCode (PKCE); verifier stored httpOnly, consumed once |
| T-04-05 | Google access token used transiently for userinfo fetch, never stored — accepted for v1                 |
| T-04-SC | arctic package verified in 01-01 Task 0 legitimacy gate                                                 |

## Threat Flags

No new threat surface introduced beyond the plan's `<threat_model>`. All T-04-01 through T-04-05 mitigations implemented as verified above.

## Self-Check: PASSED

- `apps/api/src/services/auth-service.ts` — contains `export async function upsertGoogleUser`
- `apps/api/src/routes/auth.ts` — contains `arctic.Google`, `createAuthorizationURL`, `validateAuthorizationCode`, `/google/callback`, `invalid_oauth_state`
- `apps/web/src/app/api/auth/[...path]/route.ts` — contains `'google'` and `'callback'` in UNAUTHED_PATHS
- `cd apps/api && npm test` → 62 passed
- `cd apps/api && npm run typecheck` → clean
- `cd apps/web && npm run typecheck` → clean
- All task commits verified: c97c809, 6c5f9bd, be24d45, c964f0a
