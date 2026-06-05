# Phase 1: Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 1-authentication
**Areas discussed:** Cookie/session transport, New dependencies, Email verification gating, Refresh token security

---

## Cookie / Session Transport

| Option              | Description                                                                                                                                                                        | Selected |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| BFF proxy (Next.js) | Browser only calls Next.js route handlers (same-origin); Next.js forwards to Workers API and relays Set-Cookie. Cookies SameSite=Lax on web domain. API needs no CORS credentials. | ✓        |
| Direct cross-origin | Browser calls Workers API directly with credentials:'include'; API sets SameSite=None;Secure cookies + strict CORS.                                                                |          |

**User's choice:** BFF proxy (Next.js)
**Notes:** Cleanest CSRF/cookie story; API never needs CORS credentials.

### Follow-up: Auto-refresh mechanism

| Option               | Description                                                                                                                       | Selected |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Transparent in proxy | BFF detects near-expired access token, silently refreshes, sets new cookie, completes original request. Browser never sees a 401. | ✓        |
| Reactive on 401      | BFF forwards normally; on 401 it refreshes and retries once. Extra hop at expiry boundary.                                        |          |
| Next.js middleware   | Middleware checks expiry on requests and refreshes proactively; also guards protected routes.                                     |          |

**User's choice:** Transparent in proxy
**Notes:** Wants a seamless, invisible session — no 401 flashes or client retry logic.

---

## New Dependencies

### Resend (email)

| Option                | Description                                                                  | Selected |
| --------------------- | ---------------------------------------------------------------------------- | -------- |
| Raw fetch to REST API | Call Resend HTTPS REST endpoint with fetch(); zero new deps, Workers-native. |          |
| Official resend SDK   | Add `resend` npm package; typed API, more bundle weight.                     | ✓        |

**User's choice:** Official resend SDK (approved new dependency)

### Google OAuth

| Option                | Description                                                             | Selected |
| --------------------- | ----------------------------------------------------------------------- | -------- |
| Arctic library        | Tiny, dependency-free OAuth 2.0 lib built for edge runtimes.            | ✓        |
| @hono/oauth-providers | Hono's official OAuth middleware with built-in Google provider.         |          |
| Hand-rolled fetch     | Build the OAuth2 authorization-code flow manually with fetch(); no dep. |          |

**User's choice:** Arctic library (approved new dependency)
**Notes:** Both `resend` and `arctic` approved for `apps/api` per the "no new deps without approval" rule.

---

## Email Verification Gating

| Option             | Description                                                                                                      | Selected |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | -------- |
| Hard-block login   | Login refused until verified (403, no session). Login UI shows resend prompt. A session always implies verified. | ✓        |
| Login but lock app | User logs in but every route is blocked behind a verify interstitial until verified.                             |          |

**User's choice:** Hard-block login

### Follow-up: Link token mechanism

| Option            | Description                                                                                                             | Selected |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| DB token + expiry | Random opaque token, store sha256 hash + expiresAt; single-use, deleted on redemption. Server-side revocation possible. | ✓        |
| Signed JWT link   | Encode purpose+userId+expiry into a signed JWT; stateless, no table, but can't revoke before expiry.                    |          |

**User's choice:** DB token + expiry
**Notes:** Verify links ~24h, reset links ~1h.

---

## Refresh Token Security

| Option                | Description                                                                                                                                             | Selected |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| DB-stored + rotation  | Store hash of each refresh token; rotate on every refresh, revoke old, detect reuse as theft. Logout deletes row → true revocation / logout-everywhere. | ✓        |
| Stateless JWT refresh | Refresh token is a signed JWT; no table; logout only clears cookie, can't revoke server-side.                                                           |          |

**User's choice:** DB-stored + rotation
**Notes:** Consistent with the DB-token choice for verification/reset; enables logout-everywhere.

---

## Claude's Discretion

User chose "I'm ready for context" rather than discussing these further; recommended defaults recorded in CONTEXT.md:

- Account linking (same email via password + Google) — recommended: email as identity key, link Google to existing account.
- Password policy — recommended: min 8 chars, Zod validation, no breach-check service for v1.
- Rate limiting on login & reset — recommended: lightweight throttling/lockout, or explicitly deferred with documented reason.
- Welcome vs verification email — one combined send or two separate, Claude's discretion.

## Deferred Ideas

None — discussion stayed within phase scope.
