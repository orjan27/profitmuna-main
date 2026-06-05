# Phase 1: Authentication - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A complete authentication system for the single-user Profitmuna app:

- Email/password registration with **required** email verification (Resend)
- JWT sessions: 30-min access token + 7-day refresh token, both in httpOnly cookies, with automatic refresh
- Google OAuth login (first login auto-creates the account; subsequent logins sign in)
- Password reset via emailed link (Resend)
- Logout (clears tokens) from any page
- Transactional emails via Resend: verification, welcome (after registration), password reset

Covers requirements **AUTH-01 … AUTH-06**.

**Not in this phase:** any finance features (income, expenses, allocations, wallets), settings, notifications, dashboard. Multi-tenancy/roles are permanently out of scope (single-user app).

</domain>

<decisions>
## Implementation Decisions

### Session Transport & Cookies

- **D-01:** Use a **BFF (backend-for-frontend) proxy in Next.js**. The browser only ever calls Next.js route handlers (same-origin); Next.js forwards to the Workers API and relays `Set-Cookie`. The API is not called directly from the browser for authenticated requests.
- **D-02:** Auth cookies are **httpOnly, `SameSite=Lax`, `Secure` in production**, set on the web (Next.js) origin. Because all auth traffic is same-origin via the BFF, the Workers API does **not** need CORS credentials / `SameSite=None`.
- **D-03:** Access-token refresh is **transparent inside the BFF proxy**: when a forwarded request carries a near-expired/expired access token, the proxy silently uses the refresh token to mint a new access token, sets the new cookie, and completes the original request. The browser never sees a 401 from token expiry. (No client-side retry/interceptor logic.)

### Dependencies (approved — new deps OK'd by user)

- **D-04:** Add the **official `resend` SDK** to `apps/api` for all transactional email (verification, welcome, reset).
- **D-05:** Add **`arctic`** to `apps/api` for the Google OAuth 2.0 flow (authorization URL, state/PKCE, token exchange). Edge/Workers-friendly.
- **D-06:** `jose` (JWT) and `bcryptjs` (password hashing) are already present in `apps/api` — use them; no need to add.

### Email Verification Gating

- **D-07:** **Hard-block login until verified.** An unverified user's login attempt returns `403 email_not_verified` and **no session is issued**. Invariant: _a valid session always implies a verified email._ The login UI surfaces a "verify your email / resend link" prompt.
- **D-08:** A welcome email is sent **after successful registration** (AUTH-06); the verification email is the action item, the welcome email is the greeting. (Whether they are one combined email or two separate sends is Claude's discretion — see below.)

### Link Token Mechanism (verification + reset)

- **D-09:** Verification and password-reset links use **DB-stored, hashed (sha256), cryptographically-random, single-use tokens** with an `expiresAt`. The raw token rides in the link; redemption looks up the hash, checks expiry, and deletes/consumes the row.
- **D-10:** Token lifetimes: **verification ~24h, password reset ~1h** (planner may fine-tune within reason).

### Refresh Token Security

- **D-11:** Refresh tokens are **DB-stored as hashes with rotation**: every refresh issues a new refresh token and revokes the previous one. Reuse of an already-revoked refresh token is treated as **token theft** (revoke the chain / all sessions for that user).
- **D-12:** **Logout deletes the refresh-token row(s)**, giving true server-side revocation and the ability to "log out everywhere." (Per ROADMAP success criterion: logout clears all tokens.)

### Claude's Discretion

The user opted to let research/planning make sensible default calls on the following (recommended defaults noted — planner may refine):

- **Account linking (same email via password + Google):** _Recommended default_ — treat email as the identity key. Google emails are pre-verified, so signing in with Google when an account with that email already exists should **link** the Google identity to the existing account (and mark it verified) rather than create a duplicate or error. If a user first signed up via Google and later tries email/password registration with the same email, prefer guiding them to "sign in with Google" (or support setting a password) rather than silently creating a second account. Flag any deviation explicitly in the plan.
- **Password policy:** _Recommended default_ — minimum 8 characters, basic server-side validation via Zod; no external breach-check service for v1.
- **Rate limiting on login & password-reset endpoints:** _Recommended default_ — apply lightweight throttling/lockout to mitigate brute force and reset-link abuse. Note: there is no rate-limit infrastructure yet; planner should choose a Workers/D1-appropriate approach or explicitly defer with a documented reason.
- **Welcome vs verification email:** one combined email or two separate sends — Claude's discretion.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs

- `.planning/PROJECT.md` — locked Key Decisions (JWT 30/7-day httpOnly, Resend for all email, single-user), constraints, and out-of-scope list
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01…AUTH-06 acceptance text
- `.planning/ROADMAP.md` §"Phase 1: Authentication" — goal + 6 success criteria (verification-before-access, JWT cookie spec, Google first-login, reset flow, logout clears tokens, welcome email)

### Codebase maps

- `.planning/codebase/STACK.md` — pinned versions / runtime constraints
- `.planning/codebase/STRUCTURE.md` — STRICT folder rules (routes/services/schemas/middleware/lib split)
- `.planning/codebase/INTEGRATIONS.md` — external integration notes
- `CLAUDE.md` + `STANDARDS.md` + `.claude/rules/structure.md` — enforced structure, naming, error/response shape, path aliases

### Reference implementation

- `/mnt/c/dev/profitfirst/practice` — finance reference app. **Note:** it has **no auth and no email integration**; auth + Resend are net-new design for Profitmuna. Use it only for general Hono/Drizzle/D1 conventions, not for auth patterns.

No external auth ADRs/specs exist — auth design is captured in the decisions above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api` already depends on **`jose`** (JWT sign/verify) and **`bcryptjs`** (password hashing) — the core auth primitives are installed.
- `apps/web/src/lib/utils.ts` (`cn`) + shadcn/ui setup (`components.json`) — auth screens reuse the existing UI primitive stack.

### Established Patterns

- **STRICT structure (enforced by PreToolUse hook):** API routes stay thin in `apps/api/src/routes/`; business logic in `apps/api/src/services/`; Zod schemas in `apps/api/src/schemas/`; middleware (auth guard) in `apps/api/src/middleware/`; framework-agnostic helpers (email, token, oauth) in `apps/api/src/lib/`.
- **DB:** single Drizzle schema source of truth at `packages/db/src/schema.ts`; access only via `@app/db`. Migrations via Drizzle Kit in `packages/db/migrations/` (`/run-migrations`).
- **Web ↔ API:** browser → Next.js (BFF) → Hono API. No direct DB access from web. `NEXT_PUBLIC_API_URL` is the API base (used server-side by the BFF, not exposed for auth calls from the browser).

### Integration Points

- **Schema work needed** in `packages/db/src/schema.ts`: extend `users` (currently only `id/email/name/createdAt`) with at least `passwordHash` (nullable for OAuth-only), `emailVerified`/`verifiedAt`, `googleId`; add a **`refresh_tokens`** table (hashed token, userId, expiresAt, rotation lineage) and an **auth/verification `tokens`** table (hashed token, userId, purpose: verify|reset, expiresAt). Note current `users.id` is autoincrement integer.
- **API surface (net-new):** `apps/api/src/index.ts` currently only has `/health` + `/api/hello`. Auth routes (register, login, logout, refresh, verify-email, resend-verification, forgot-password, reset-password, Google authorize + callback) are all new.
- **New env vars required:** `JWT_SECRET` (or access/refresh secrets), `RESEND_API_KEY`, verification "from" address, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, Google redirect URI, and an app base URL for building email links. None exist in `.env.example` yet — must be added (no secrets committed).
- **Cloudflare bindings:** secrets via Workers env/`wrangler.toml`; `c.env.DB` already typed as `Bindings`.

</code_context>

<specifics>
## Specific Ideas

- ROADMAP fixes the token spec exactly: **30-min access / 7-day refresh, httpOnly cookies, auto-refresh** — non-negotiable.
- All email goes through **Resend** (no other provider).
- The BFF + transparent-refresh choice means the user wants a **seamless, invisible session experience** — no auth-related flicker, 401 flashes, or manual re-login within the 7-day window.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Scheduled reminder emails, in-app notification center, and currency settings remain in Phase 6; finance features in Phases 2–5.)

</deferred>

---

_Phase: 1-authentication_
_Context gathered: 2026-06-05_
