---
phase: 01-authentication
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - apps/api/src/index.ts
  - apps/api/src/lib/email.ts
  - apps/api/src/lib/jwt.ts
  - apps/api/src/lib/password.ts
  - apps/api/src/lib/token.ts
  - apps/api/src/middleware/auth.ts
  - apps/api/src/middleware/security-headers.ts
  - apps/api/src/routes/auth.ts
  - apps/api/src/schemas/auth.ts
  - apps/api/src/services/auth-service.ts
  - apps/api/src/types/index.ts
  - apps/api/tests/auth.test.ts
  - apps/api/tests/helpers/db.ts
  - apps/api/tsconfig.json
  - apps/api/vitest.config.ts
  - apps/api/wrangler.toml
  - apps/web/next.config.ts
  - apps/web/src/app/(auth)/forgot-password/page.tsx
  - apps/web/src/app/(auth)/login/page.tsx
  - apps/web/src/app/(auth)/register/page.tsx
  - apps/web/src/app/(auth)/reset-password/page.tsx
  - apps/web/src/app/(auth)/verify-email/VerifyEmailStatus.tsx
  - apps/web/src/app/(auth)/verify-email/page.tsx
  - apps/web/src/app/api/auth/[...path]/route.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/components/auth/ForgotPasswordForm.tsx
  - apps/web/src/components/auth/LoginForm.tsx
  - apps/web/src/components/auth/RegisterForm.tsx
  - apps/web/src/components/auth/ResetPasswordForm.tsx
  - apps/web/src/middleware.ts
  - apps/web/src/server/auth.ts
  - packages/db/migrations/0000_sleepy_machine_man.sql
  - packages/db/src/schema.ts
findings:
  critical: 4
  warning: 9
  info: 5
  total: 18
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed the Phase 01 authentication implementation across the Hono API, the Next.js BFF/UI layer, and the Drizzle schema. The core token primitives (PBKDF2 hashing, SHA-256 token hashing, constant-time hex compare, JWT iss/aud allowlisting, refresh-token rotation with reuse detection) are correctly built and well-tested.

However, adversarial tracing surfaced four genuine security defects that ship in this code: the Google OAuth callback never checks the provider's `email_verified` flag (or the userinfo HTTP status) before auto-creating/linking a fully verified account, opening an account-takeover/forged-account path; the email-sending endpoints `register` and `resend-verification` have no rate limiting despite `security.md` requiring it (email-bomb / cost-abuse vector); login leaks account existence through a timing side channel because the expensive password hash is skipped for unknown emails; and the lockout counter logic permanently re-locks an account on a single failed attempt after the first lockout window. Several quality defects (dead code, an unused binding, default CORS, prod CSP weakening) accompany these.

The documented Phase deviations (PBKDF2 vs bcrypt, 30-min access JWT, duplicated HSTS) were treated as accepted and are NOT flagged.

## Critical Issues

### CR-01: Google OAuth callback ignores `email_verified` and userinfo HTTP status — forged/unverified account takeover

**File:** `apps/api/src/routes/auth.ts:248-263`
**Issue:** The callback fetches Google userinfo, casts the JSON to a typed shape with no validation, and passes `email` directly to `upsertGoogleUser` — which links by email and unconditionally sets `emailVerified: true` (`apps/api/src/services/auth-service.ts:454-468`). Two problems:

1. The selected `email_verified` field is fetched but **never checked**. Google can return `email_verified: false` (e.g. Workspace domains with unverified aliases). The code still links that email to an existing password account and marks it verified, letting a holder of an unverified Google identity hijack a local account.
2. `userRes.ok` is never checked. If the userinfo call returns a non-200 (revoked token, rate limit), `await userRes.json()` yields an error body; `googleUser.email`/`sub` become `undefined`, and `upsertGoogleUser` will then `INSERT` a row with `email: undefined` or match unexpectedly.

The "account-linking: email is the identity key" comment is precisely the dangerous assumption — email is only an identity key if the provider asserts it is verified.

**Fix:**

```ts
const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!userRes.ok) {
  throw new HTTPException(400, { message: 'oauth_userinfo_failed' });
}
const raw = (await userRes.json()) as unknown;
// Narrow with a Zod schema in schemas/auth.ts instead of a bare cast:
const googleUser = googleUserinfoSchema.parse(raw); // { sub, email, name, email_verified }
if (!googleUser.email_verified) {
  throw new HTTPException(400, { message: 'email_not_verified' });
}
```

Then only call `upsertGoogleUser` after the verified check passes.

### CR-02: No rate limiting on `register` / `resend-verification` — email-bomb and cost-abuse vector

**File:** `apps/api/src/routes/auth.ts:38-56` (register), `apps/api/src/routes/auth.ts:72-89` (resend-verification)
**Issue:** `security.md` mandates: "Apply rate limiting to authentication endpoints, password reset, and any endpoint that sends email or SMS. Return `429` with `Retry-After`." `forgot-password` got a per-email cooldown (`RESET_COOLDOWN_MS`), but `register` and `resend-verification` both call `sendVerificationEmail` (register sends two emails) with no throttle whatsoever. An attacker can:

- POST `register` repeatedly with a victim's address (each existing-email call returns null and sends nothing, but each _new_ address sends 2 emails — unbounded outbound mail through your Resend account = quota/cost abuse and sender-reputation damage).
- POST `resend-verification` in a loop for any unverified address to flood that inbox.

**Fix:** Apply the same `login_attempts`-backed cooldown pattern already used in `forgotPassword` (keyed e.g. `__verify__<email>`) inside `resendVerification`, and add a per-IP or per-email cooldown to `register` before issuing tokens/emails. Return `429` with a `Retry-After` header when throttled.

### CR-03: Login user-enumeration via password-hash timing side channel

**File:** `apps/api/src/services/auth-service.ts:209-210`
**Issue:**

```ts
const passwordValid =
  user?.passwordHash != null && (await verifyPassword(password, user.passwordHash));
```

Short-circuit evaluation means that when the email does **not** exist (or is a Google-only account with `passwordHash === null`), `verifyPassword` — i.e. the 210k-iteration PBKDF2 derivation — is never executed. A known-good account incurs ~tens-of-ms of PBKDF2 work; an unknown account returns near-instantly. This measurable timing delta lets an attacker enumerate registered emails, defeating the enumeration mitigations applied everywhere else in this phase (generic 201, generic forgot-password body).

**Fix:** Always perform a hash computation against a dummy hash when the user/passwordHash is absent, so both paths cost the same:

```ts
const DUMMY_HASH = 'pbkdf2$sha256$210000$<16-byte-salt-hex>$<32-byte-hash-hex>';
const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
const passwordValid = (await verifyPassword(password, hashToCheck)) && user?.passwordHash != null;
```

### CR-04: Lockout logic permanently re-locks on a single failed attempt after the first lockout window

**File:** `apps/api/src/services/auth-service.ts:214-226`
**Issue:** On a failed attempt the counter is only ever incremented; it is reset to 0 _only on successful login_ (lines 243-248). After the first lockout the row holds `count = 5` (or more) with `lockedUntil` now in the past. Once the window expires, the very next failed attempt computes `newCount = 6 >= MAX_LOGIN_ATTEMPTS` and immediately re-locks for another 15 minutes. Net effect: after one lockout, a legitimate user who fat-fingers their password even once is instantly locked again, and an attacker can keep a victim permanently locked out with a single wrong-password request every 15 minutes — a low-cost account-DoS.

**Fix:** When a prior `lockedUntil` has elapsed, reset the counter before counting the new attempt:

```ts
const lockoutExpired = attempt.lockedUntil != null && new Date(attempt.lockedUntil) <= new Date();
const baseCount = lockoutExpired ? 0 : attempt.count;
const newCount = baseCount + 1;
const lockedUntil =
  newCount >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
```

## Warnings

### WR-01: Default `cors()` sends `Access-Control-Allow-Origin: *` and allows all methods

**File:** `apps/api/src/index.ts:11`
**Issue:** `app.use('/*', cors())` uses Hono's defaults, which reflect `Access-Control-Allow-Origin: *` and a broad method/header set. `security.md` requires allowlisting specific origins and limiting `Access-Control-Allow-Methods` to those actually used. Although the browser only talks to the same-origin BFF today (so credentialed CORS is not currently the exposure), a wildcard CORS policy on an authentication API is a latent misconfiguration that invites direct cross-origin probing.
**Fix:** Configure explicitly: `cors({ origin: c.env.APP_BASE_URL, allowMethods: ['GET', 'POST'], credentials: false })`. Since the secret/origin is request-scoped on Workers, use the function form of `origin`.

### WR-02: `assertLoginAllowed` is dead, unreachable code

**File:** `apps/api/src/services/auth-service.ts:153-169`
**Issue:** `assertLoginAllowed` is exported but never imported anywhere (the route uses `login`, which independently reimplements credential + verification checks). Dead code in a security module is a maintenance hazard — a future caller may use this variant, which has **no lockout enforcement**, silently bypassing the brute-force protection in `login`.
**Fix:** Delete `assertLoginAllowed`, or have `login` delegate to it so there is a single source of truth for the credential gate.

### WR-03: `JWT_REFRESH_SECRET` binding declared and required but never used

**File:** `apps/api/src/types/index.ts:4`, `apps/api/src/lib/jwt.ts:32-40`, `apps/api/tests/helpers/db.ts:173`
**Issue:** Refresh tokens are opaque random strings stored as SHA-256 hashes (`auth-service.ts:252-257`), not JWTs. `JWT_REFRESH_SECRET` is in `Bindings` (and `signRefreshToken` exists in `lib/jwt.ts`) but neither is used by any runtime path — `signRefreshToken` is only exercised by a test. This is a misleading config surface: an operator will provision a secret that does nothing, and a reader may assume refresh tokens are signed JWTs.
**Fix:** Remove `JWT_REFRESH_SECRET` from `Bindings`/`wrangler.toml` and delete the unused `signRefreshToken`, or document why they exist. Keep the implementation honest about the refresh-token scheme.

### WR-04: `/logout` requires a valid (unexpired) access token — logout fails for expired sessions

**File:** `apps/api/src/routes/auth.ts:145-152`
**Issue:** `requireAuth` rejects expired access tokens with 401. Logout is exactly the moment an access token is most likely stale. The BFF's transparent refresh mitigates this for browser flows, but `logout` is not in the BFF `UNAUTHED_PATHS` set and the refresh itself can fail (revoked/expired refresh token), in which case the user cannot log out and the server-side refresh-token rows are never deleted (their session remains revocable only by expiry). Logout should be resilient to an expired/absent access token.
**Fix:** Allow logout to proceed using the `refresh_token` cookie (look up the row, delete the user's tokens) even when the access token is invalid, rather than gating it behind `requireAuth`.

### WR-05: Google userinfo response consumed via unchecked `as` cast (no boundary narrowing)

**File:** `apps/api/src/routes/auth.ts:251-256`
**Issue:** `(await userRes.json()) as { sub; email; name; email_verified }` violates the project rule "Narrow unknowns at the boundary. Do not leak `unknown` into business logic" and CLAUDE.md's "Use Zod to parse untyped data." An external provider response is trusted wholesale; any field could be missing. (Closely tied to CR-01.)
**Fix:** Define a Zod schema for the Google userinfo payload in `schemas/auth.ts` and `.parse()` the response.

### WR-06: `next.config.ts` ships `'unsafe-eval'` + `'unsafe-inline'` in the production CSP

**File:** `apps/web/next.config.ts:15-16`
**Issue:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` is applied unconditionally, including production builds. The comment says these are needed "in dev," but the config does not gate on environment, so production inherits a CSP that permits inline script and `eval`, substantially weakening XSS defense for an app handling financial data.
**Fix:** Gate the relaxed directives on `process.env.NODE_ENV !== 'production'`; in production use nonces/hashes (Next.js supports a nonce-based CSP via middleware) and drop `'unsafe-eval'`.

### WR-07: `Server` / `X-Powered-By` headers not stripped

**File:** `apps/web/next.config.ts:28-37`, `apps/api/src/middleware/security-headers.ts:13-24`
**Issue:** `security.md`: "Remove `Server` and `X-Powered-By` headers in production." Next.js emits `X-Powered-By: Next.js` by default and neither config disables it (`poweredByHeader: false` is absent), nor does the API middleware strip platform headers. Minor info disclosure / fingerprinting.
**Fix:** Add `poweredByHeader: false` to `next.config.ts`; explicitly `c.res.headers.delete('Server')`/`'X-Powered-By'` in the API security-headers middleware.

### WR-08: `forgotPassword` rate-limit row reuses `login_attempts` with a colliding key space and an unbounded counter

**File:** `apps/api/src/services/auth-service.ts:373-401`
**Issue:** Reset cooldown rows are keyed `__reset__<email>` in the same `login_attempts` table used for login lockout. The `count` for these rows is incremented on every reset request and never reset, so it grows unbounded (harmless today but dead state). More importantly, keying by a string-prefixed email in a shared table is fragile: a user whose literal email begins with `__reset__` would collide with the lockout namespace. The coupling also means a `login`-side counter reset (keyed by plain email) and the reset-side row drift independently with no cleanup.
**Fix:** Either add a dedicated `purpose`/`kind` column (or a separate table) for reset throttling instead of namespacing via string prefix, and stop incrementing a counter you never read.

### WR-09: `verifyPassword` silently mis-parses odd-length salt hex

**File:** `apps/api/src/lib/password.ts:73`
**Issue:** `saltHex.match(/.{2}/g)` drops a trailing nibble if `saltHex` has odd length, and `parseInt` of a non-hex pair yields `NaN` → a salt byte of `NaN`. A corrupted/tampered stored hash therefore derives against a malformed salt instead of being cleanly rejected. It will return `false` (no auth bypass), but it fails ambiguously rather than explicitly.
**Fix:** Validate the salt hex shape before parsing: `if (!/^[0-9a-f]+$/i.test(saltHex) || saltHex.length % 2 !== 0) return false;` and reject `NaN` bytes.

## Info

### IN-01: `login_attempts` lockout is per-email only — distributed/IP dimension absent

**File:** `apps/api/src/services/auth-service.ts:197-235`
**Issue:** Lockout keys solely on email. An attacker spraying many emails from one IP is unthrottled, and a victim can be locked out by an attacker targeting their email (see CR-04). The "non-atomic race accepted for v1" note acknowledges the concurrency gap. Documented as a v1 trade-off; flagged for the backlog.
**Fix:** Add an IP-dimension or per-IP global throttle in a later phase.

### IN-02: `register` does not enforce the email-verified login gate against re-registration of unverified accounts

**File:** `apps/api/src/services/auth-service.ts:81-82`
**Issue:** Re-registering an existing (even unverified) email returns null and sends nothing, so a user who registered but lost the verification email cannot trigger a resend via `register` — they must know to use `resend-verification`. Functionally correct for enumeration safety; noting the UX edge.
**Fix:** Acceptable; ensure the UI funnels such users to resend (the LoginForm already does on 403).

### IN-03: `c.executionCtx.waitUntil` failures are swallowed only via per-send `console.error`

**File:** `apps/api/src/lib/email.ts:28,38,48`, `apps/api/src/routes/auth.ts:50-51`
**Issue:** Email send errors are logged but the caller has no signal; a persistently failing Resend key means users silently never receive verification/reset mail. Reasonable for non-blocking sends, but there is no alerting/metric. Logging `{ to }` also logs a PII email address, which `security.md`/CLAUDE.md discourage ("Never log PII").
**Fix:** Log a hashed/truncated recipient or just a correlation id instead of the raw `to` address.

### IN-04: Test DDL is hand-maintained and can drift from the Drizzle schema / migration

**File:** `apps/api/tests/helpers/db.ts:11-46`
**Issue:** The raw `DDL` string duplicates `schema.ts` and `0000_sleepy_machine_man.sql`. The comment acknowledges "keep in sync" — but nothing enforces it, so tests can pass against a schema that no longer matches production (e.g. a missing index or column default). The migration uses `email_verified ... DEFAULT false` while the shim uses `DEFAULT 0`; equivalent today but a drift risk.
**Fix:** Generate the test schema from the migration SQL (apply `0000_*.sql` directly) rather than re-declaring DDL by hand.

### IN-05: `database_id = "local"` placeholder committed in `wrangler.toml`

**File:** `apps/api/wrangler.toml:9`
**Issue:** Placeholder `database_id` with an inline reminder comment. Not a secret, but shipping a non-real id risks an accidental deploy against an unintended/empty database if the comment is missed.
**Fix:** Acceptable for local dev; ensure the deploy runbook hard-requires substituting the real D1 id (consider a separate `[env.production]` block).

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
