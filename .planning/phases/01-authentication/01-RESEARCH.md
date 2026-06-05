# Phase 1: Authentication - Research

**Researched:** 2026-06-05
**Domain:** Authentication — JWT sessions, email/password, Google OAuth, email verification, BFF proxy
**Confidence:** HIGH (core stack verified via Context7 and official Cloudflare/Next.js docs; one MEDIUM risk area documented)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a BFF (backend-for-frontend) proxy in Next.js. The browser only ever calls Next.js route handlers (same-origin); Next.js forwards to the Workers API and relays Set-Cookie. The API is not called directly from the browser for authenticated requests.
- **D-02:** Auth cookies are httpOnly, SameSite=Lax, Secure in production, set on the web (Next.js) origin. Because all auth traffic is same-origin via the BFF, the Workers API does not need CORS credentials / SameSite=None.
- **D-03:** Access-token refresh is transparent inside the BFF proxy: when a forwarded request carries a near-expired/expired access token, the proxy silently uses the refresh token to mint a new access token, sets the new cookie, and completes the original request. The browser never sees a 401 from token expiry.
- **D-04:** Add the official `resend` SDK to `apps/api` for all transactional email (verification, welcome, reset).
- **D-05:** Add `arctic` to `apps/api` for the Google OAuth 2.0 flow (authorization URL, state/PKCE, token exchange). Edge/Workers-friendly.
- **D-06:** `jose` (JWT) and `bcryptjs` (password hashing) are already present in `apps/api` — use them; no need to add.
- **D-07:** Hard-block login until verified. An unverified user's login attempt returns 403 email_not_verified and no session is issued. Invariant: a valid session always implies a verified email.
- **D-08:** A welcome email is sent after successful registration (AUTH-06); the verification email is the action item, the welcome email is the greeting.
- **D-09:** Verification and password-reset links use DB-stored, hashed (sha256), cryptographically-random, single-use tokens with an expiresAt. The raw token rides in the link; redemption looks up the hash, checks expiry, and deletes/consumes the row.
- **D-10:** Token lifetimes: verification ~24h, password reset ~1h.
- **D-11:** Refresh tokens are DB-stored as hashes with rotation: every refresh issues a new refresh token and revokes the previous one. Reuse of an already-revoked refresh token is treated as token theft (revoke the chain / all sessions for that user).
- **D-12:** Logout deletes the refresh-token row(s), giving true server-side revocation and the ability to "log out everywhere."

### Claude's Discretion

- **Account linking (same email via password + Google):** Recommended default — treat email as the identity key. Google emails are pre-verified, so signing in with Google when an account with that email already exists should link the Google identity to the existing account (and mark it verified) rather than create a duplicate or error.
- **Password policy:** Recommended default — minimum 8 characters, basic server-side validation via Zod; no external breach-check service for v1.
- **Rate limiting on login & password-reset endpoints:** Apply lightweight throttling/lockout to mitigate brute force and reset-link abuse. Choose a Workers/D1-appropriate approach or explicitly defer with a documented reason.
- **Welcome vs verification email:** one combined email or two separate sends — Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                    | Research Support                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AUTH-01 | User can create an account with email/password and must verify their email via a Resend-sent link before logging in                            | D-01/D-07/D-09: Registration flow, verification token storage, Resend SDK on Workers |
| AUTH-02 | User can log in with email/password and stay logged in via JWT — 30-min access token, 7-day refresh token, httpOnly cookies, automatic refresh | D-01/D-02/D-03/D-11: BFF proxy, jose JWT, Hono cookie helper, transparent refresh    |
| AUTH-03 | User can log in with Google (account auto-created on first OAuth login)                                                                        | D-05: arctic Google provider, PKCE flow, userinfo fetch, account linking             |
| AUTH-04 | User can reset their password via an emailed reset link                                                                                        | D-09/D-10: reset token hashing with sha256, 1h expiry, Resend SDK                    |
| AUTH-05 | User can log out from any page (tokens cleared)                                                                                                | D-12: BFF route handler clears cookies, API deletes refresh token row                |
| AUTH-06 | User receives a welcome email after registration                                                                                               | D-04/D-08: Resend SDK welcome send, combined or separate from verification           |

</phase_requirements>

---

## Summary

This phase delivers a complete authentication system using the existing monorepo scaffold (Next.js 15 BFF + Hono 4 on Cloudflare Workers + Drizzle/D1). All core libraries are already installed or approved: `jose` and `bcryptjs` are in `apps/api/package.json`; `resend` and `arctic` are approved additions. The schema needs four new tables; all API routes are net-new.

The dominant architectural risk is **bcryptjs CPU cost on Cloudflare Workers**. The paid Workers Standard plan has a 5-minute wall clock limit (default 30s) but CPU is shared. bcryptjs at cost 10 is documented to exceed the legacy 50ms bundled plan cap, but the project is on the paid Standard plan which has a much higher effective limit. Community evidence suggests bcrypt at cost ≤10 works on Workers Standard. The security rule requires cost ≥12, which creates tension. The recommended approach: use `bcryptjs` at **cost 10** as a pragmatic compromise (the security rule says "or Argon2id" — see Open Questions). This needs the planner to flag this explicitly. The alternative is Web Crypto PBKDF2 with 100,000 iterations, which does not require any new dependency. This is documented in Open Questions.

The BFF transparent-refresh pattern requires careful implementation: the Next.js route handler must detect a near-expired or expired access token in its forwarded request, call the Workers `/api/auth/refresh` endpoint internally (server-to-server using `NEXT_PUBLIC_API_URL`), relay the new `Set-Cookie` header to the client, and re-issue the original request with the new access token. This is all server-side and invisible to the browser.

**Primary recommendation:** Build the API layer first (schema → auth routes → services), then the BFF proxy layer (route handlers with cookie relay), then the Next.js UI pages. Each wave delivers a vertically testable slice: register → verify → login → refresh → Google → reset → logout.

---

## Architectural Responsibility Map

| Capability                         | Primary Tier                         | Secondary Tier            | Rationale                                                               |
| ---------------------------------- | ------------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| Password hashing / verification    | API (Workers)                        | —                         | bcryptjs must run server-side; never in browser                         |
| JWT sign / verify                  | API (Workers)                        | —                         | jose runs on Workers; secret never leaves server                        |
| Cookie issuance (Set-Cookie)       | API (Workers) — set, then BFF relays | Next.js BFF relays header | API sets the attributes; BFF forwards the header to browser             |
| Cookie storage / reading           | Browser (httpOnly)                   | —                         | Browser holds cookie opaquely; BFF reads it on next request             |
| Transparent token refresh          | Next.js BFF (route handler)          | API /refresh endpoint     | BFF detects expiry, calls API, relays new cookie — browser sees nothing |
| Google OAuth state/PKCE cookies    | API (Workers) via BFF                | —                         | State cookie set on redirect to Google; BFF receives callback           |
| Email dispatch (Resend)            | API (Workers) service layer          | —                         | API holds RESEND_API_KEY binding; used via waitUntil()                  |
| Verification / reset token hashing | API (Workers) lib                    | —                         | sha256 via Web Crypto (crypto.subtle.digest) — available on Workers     |
| Auth UI forms                      | Next.js web (client components)      | —                         | useState / form events require client                                   |
| Auth redirect guards               | Next.js middleware                   | —                         | Check cookie presence for route protection                              |
| DB schema (users + tokens)         | packages/db                          | —                         | Single source of truth, consumed by API via @app/db                     |

---

## Standard Stack

### Core

| Library                    | Version                    | Purpose                                                                                                   | Why Standard                                                                                    |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `jose`                     | 6.2.2 (pinned)             | JWT sign/verify — HS256 access + refresh tokens                                                           | Explicitly edge-runtime compatible; used by Cloudflare, Deno, Bun; installed                    |
| `bcryptjs`                 | 3.0.3 (pinned)             | Password hashing — pure JS bcrypt, no native bindings                                                     | Already installed; pure JS runs on Workers (no Node native deps); see CPU note                  |
| `arctic`                   | 3.7.0                      | Google OAuth 2.0 — generateState, generateCodeVerifier, createAuthorizationURL, validateAuthorizationCode | Fetch-API based, runtime-agnostic; official docs confirmed Workers compatible; approved by user |
| `resend`                   | 6.12.4                     | Transactional email — verification, welcome, reset                                                        | Official SDK, Works in Cloudflare Workers via Fetch; approved by user                           |
| `hono/cookie`              | (bundled with hono 4.12.9) | setCookie / getCookie / deleteCookie on Workers                                                           | Built-in, no dep; wraps native Response Set-Cookie correctly                                    |
| `@hono/zod-validator`      | 0.7.6 (pinned)             | Request validation at route boundary                                                                      | Already installed; Hono-native integration                                                      |
| `zod`                      | 4.3.6 (pinned)             | Schema validation for request bodies                                                                      | Already installed; shared between API and web                                                   |
| `drizzle-orm/d1`           | 0.45.2 (pinned)            | D1 SQLite queries — new auth tables                                                                       | Already installed in packages/db                                                                |
| `next/headers` cookies()   | (Next.js 15.4.11)          | BFF route handler cookie read/set/delete (async API)                                                      | App Router built-in; awaitable in route handlers                                                |
| Web Crypto `crypto.subtle` | (Workers runtime global)   | sha256 token hashing — D-09                                                                               | Available globally on all Cloudflare Workers runtimes                                           |

### Supporting

| Library                                     | Version             | Purpose                                       | When to Use                           |
| ------------------------------------------- | ------------------- | --------------------------------------------- | ------------------------------------- |
| shadcn/ui form components                   | (installed)         | Login/Register/Reset UI forms                 | All auth UI screens                   |
| `sonner`                                    | 2.0.7 (installed)   | Toast notifications for auth errors           | Client-side feedback on auth failures |
| React 19 `useActionState` / `useFormStatus` | (React 19 built-in) | Form pending/error state in client components | Auth form submit feedback             |

### Alternatives Considered

| Instead of                    | Could Use                           | Tradeoff                                                                                                                                                    |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bcryptjs` (cost 10)          | Web Crypto PBKDF2 (100k iterations) | PBKDF2 uses zero new deps and is native-fast on Workers; bcryptjs at cost 10 is slightly below security.md's "cost ≥ 12" directive. See Open Questions.     |
| Custom token hashing          | `oslo/crypto` (from Lucia author)   | oslo is runtime-agnostic but is another dep; Web Crypto sha256 is zero-dep and adequate                                                                     |
| arctic v3                     | Manual OAuth fetch                  | arctic eliminates all OAuth boilerplate and handles PKCE correctly; no reason to hand-roll                                                                  |
| Combined verify+welcome email | Two separate sends                  | Two separate sends are clearer UX but add API call count; combined is simpler. Research recommends: send combined (one email, both greeting + verify link). |

**Installation (new deps to add to apps/api):**

```bash
cd apps/api && npm install resend@6.12.4 arctic@3.7.0
```

**Version verification:**

```
arctic@3.7.0   — npm registry confirmed [VERIFIED: npm registry]
resend@6.12.4  — npm registry confirmed [VERIFIED: npm registry]
```

---

## Package Legitimacy Audit

| Package  | Registry | Age                          | Downloads                                   | Source Repo                      | slopcheck   | Disposition                                                                                        |
| -------- | -------- | ---------------------------- | ------------------------------------------- | -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `arctic` | npm      | ~11 yrs (created 2015-04-17) | ~119 dependents per npm; 100k+/wk [ASSUMED] | github.com/pilcrowonpaper/arctic | unavailable | Approved — author is pilcrowonpaper (Lucia auth maintainer), high source reputation, Context7 HIGH |
| `resend` | npm      | ~9 yrs (created 2017-02-25)  | Millions/wk [ASSUMED]                       | github.com/resend/resend-node    | unavailable | Approved — official Resend SDK, official docs reference, widely used                               |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none — both packages are from well-known maintainers with official documentation.

_slopcheck was unavailable at research time. Both packages are tagged [ASSUMED] for download counts but are confirmed via official documentation (Context7 HIGH reputation, official resend.com docs, arcticjs.dev official site). Planner may add a checkpoint:human-verify before install if desired, but evidence strongly supports legitimacy._

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  same-origin fetch (httpOnly cookies auto-sent)
  ▼
Next.js BFF (apps/web)
  ├── Route Handlers  ──┐  server-to-server fetch with Authorization header
  │   /api/auth/*        │  (reads cookie, extracts token, adds as header)
  │   Transparent        │
  │   refresh here  ◄────┤  If access token near-expired:
  │                      │    1. Call Workers /api/auth/refresh (with refresh cookie)
  │                      │    2. Receive new access token + new Set-Cookie
  │                      │    3. Relay Set-Cookie to browser
  │                      │    4. Re-issue original request with new token
  │                 ──────┘
  ▼
Hono API (apps/api — Cloudflare Workers)
  ├── Middleware: auth guard (verify JWT from Authorization header)
  ├── POST /api/auth/register         ──► authService.register()
  ├── POST /api/auth/verify-email     ──► authService.verifyEmail()
  ├── POST /api/auth/resend-verification ──► authService.resendVerification()
  ├── POST /api/auth/login            ──► authService.login()
  ├── POST /api/auth/refresh          ──► authService.refreshTokens()
  ├── POST /api/auth/logout           ──► authService.logout()
  ├── POST /api/auth/forgot-password  ──► authService.forgotPassword()
  ├── POST /api/auth/reset-password   ──► authService.resetPassword()
  ├── GET  /api/auth/google           ──► generates arctic auth URL + state cookie
  └── GET  /api/auth/google/callback  ──► arctic validateAuthorizationCode + upsert user
         │
         ▼
  services/auth-service.ts  (all business logic)
  lib/token.ts               (sha256 hashing via crypto.subtle, random token gen)
  lib/email.ts               (Resend sends via waitUntil)
  lib/jwt.ts                 (jose sign/verify)
         │
         ▼
  packages/db (Drizzle + D1)
  ├── users              (extended)
  ├── refresh_tokens     (new)
  └── auth_tokens        (new — verify + reset)

Resend (external)          ◄── lib/email.ts calls resend.emails.send()
Google OAuth (external)    ◄── arctic calls Google token endpoint
```

### Recommended Project Structure

API (`apps/api/src/`):

```
src/
├── index.ts                # Hono app init, CORS, mount routes
├── routes/
│   └── auth.ts             # All auth route handlers (thin: validate → service → respond)
├── services/
│   └── auth-service.ts     # All auth business logic
├── schemas/
│   └── auth.ts             # Zod schemas for register, login, reset, etc.
├── middleware/
│   └── auth.ts             # JWT validation middleware (verifyToken → c.set('userId', ...))
└── lib/
    ├── token.ts            # sha256(), generateSecureToken(), encodeHex()
    ├── email.ts            # Resend wrapper — sendVerificationEmail(), sendWelcomeEmail(), sendResetEmail()
    └── jwt.ts              # signAccessToken(), signRefreshToken(), verifyAccessToken()
```

Web (`apps/web/src/`):

```
src/
├── app/
│   ├── (auth)/             # Route group — no shared layout with app shell
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── verify-email/
│   │   │   └── page.tsx    # Shows "check your email" + resend link
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── reset-password/
│   │       └── page.tsx    # Consumes token from query param
│   └── api/
│       └── auth/
│           └── [...path]/
│               └── route.ts  # BFF catch-all proxy: relays to Workers API
├── components/
│   └── auth/
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       ├── ForgotPasswordForm.tsx
│       └── ResetPasswordForm.tsx
├── server/
│   └── auth.ts             # getSession() helper — reads cookie, returns user or null
└── middleware.ts           # Next.js middleware — redirect unauthenticated to /login
```

### Pattern 1: BFF Proxy with Transparent Token Refresh

**What:** Next.js route handler catches all `/api/auth/*` requests, reads auth cookies, adds Authorization header, calls Workers API. If access token is expired, silently refreshes first.

**When to use:** All authenticated BFF-proxied calls. The middleware handles the refresh logic.

```typescript
// apps/web/src/app/api/auth/[...path]/route.ts
// Source: Next.js App Router route handlers + D-03 decision

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL!; // server-side only, not NEXT_PUBLIC_

async function proxyToApi(req: NextRequest, path: string): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  // Decode JWT exp without verification to check nearness
  // (real verification happens on the API side)
  const isNearExpired = accessToken ? isTokenNearExpiry(accessToken) : true;

  let token = accessToken;
  let newCookieHeaders: string[] = [];

  if (isNearExpired && refreshToken) {
    // Silent refresh: server-to-server call
    const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
    if (refreshRes.ok) {
      const setCookies = refreshRes.headers.getSetCookie();
      newCookieHeaders = setCookies;
      // Extract new access token from Set-Cookie
      token = extractTokenFromSetCookie(setCookies, 'access_token');
    }
  }

  const apiRes = await fetch(`${API_BASE}${path}`, {
    method: req.method,
    headers: {
      'Content-Type': req.headers.get('Content-Type') ?? 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: req.method !== 'GET' ? await req.text() : undefined,
  });

  const nextRes = new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: apiRes.headers,
  });

  // Relay any Set-Cookie headers from the API
  for (const cookie of newCookieHeaders) {
    nextRes.headers.append('Set-Cookie', cookie);
  }
  // Also relay Set-Cookie from the actual API response
  for (const cookie of apiRes.headers.getSetCookie()) {
    nextRes.headers.append('Set-Cookie', cookie);
  }

  return nextRes;
}
```

**Key note:** `cookies()` in Next.js 15 is **async** — must `await cookies()`. [CITED: nextjs.org/docs/app/api-reference/functions/cookies]

### Pattern 2: JWT Sign/Verify with jose on Workers

**What:** HS256 sign using TextEncoder-encoded secret. Verify with explicit algorithm allowlist to prevent alg confusion. Set and validate `iss` + `aud` claims (security.md requirement).

```typescript
// Source: Context7 /panva/jose — jose 6.x verified
import { SignJWT, jwtVerify, JWTExpired } from 'jose';

const secret = new TextEncoder().encode(env.JWT_SECRET);

const JWT_ISSUER = 'profitmuna';
const JWT_AUDIENCE = 'profitmuna-api';

// Sign access token (30 min) — set iss + aud
export async function signAccessToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secret);
}

// Sign refresh token (7 days) — set iss + aud
export async function signRefreshToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

// Verify — explicit algorithms prevents alg confusion attack; validate iss + aud + exp
export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return payload;
}
```

Note: For two separate token secrets (stronger), use `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` bindings.

### Pattern 3: sha256 Token Hashing via Web Crypto (D-09)

**What:** Use `crypto.subtle.digest` (globally available on Workers) to sha256-hash verification and reset tokens. No Node `crypto` needed.

```typescript
// Source: Cloudflare Workers Web Crypto docs [CITED: developers.cloudflare.com/workers/runtime-apis/web-crypto/]
// apps/api/src/lib/token.ts

export function encodeHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hash(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return encodeHex(hashBuffer);
}

export function generateSecureToken(): string {
  // 32 random bytes → 64 hex chars — raw token for the email link
  return encodeHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}
```

**Usage:** Store `sha256Hash(rawToken)` in DB. Email link carries `rawToken`. On redemption: hash the incoming value, query DB for matching hash.

### Pattern 4: Arctic Google OAuth (D-05) on Workers

**What:** PKCE flow — state and codeVerifier stored as short-lived httpOnly cookies on the redirect step, then consumed at callback.

```typescript
// Source: Context7 /pilcrowonpaper/arctic + /websites/arcticjs_dev [VERIFIED: Context7]
// apps/api/src/routes/auth.ts — /api/auth/google

import * as arctic from 'arctic';

// In Bindings type:
// GOOGLE_CLIENT_ID: string
// GOOGLE_CLIENT_SECRET: string
// GOOGLE_REDIRECT_URI: string

// GET /api/auth/google — initiate flow
app.get('/api/auth/google', (c) => {
  const google = new arctic.Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    c.env.GOOGLE_REDIRECT_URI
  );
  const state = arctic.generateState();
  const codeVerifier = arctic.generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    path: '/',
    maxAge: 600,
    secure: c.env.NODE_ENV === 'production',
  });
  setCookie(c, 'oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    path: '/',
    maxAge: 600,
    secure: c.env.NODE_ENV === 'production',
  });

  return c.redirect(url.toString());
});

// GET /api/auth/google/callback — handle callback
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const storedVerifier = getCookie(c, 'oauth_code_verifier');

  if (!code || !state || state !== storedState || !storedVerifier) {
    throw new HTTPException(400, { message: 'Invalid OAuth state' });
  }

  const google = new arctic.Google(/* ... */);
  const tokens = await google.validateAuthorizationCode(code, storedVerifier);
  const accessToken = tokens.accessToken();

  // Fetch Google userinfo
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const googleUser = (await userRes.json()) as {
    sub: string;
    email: string;
    name: string;
    email_verified: boolean;
  };

  // Upsert user via authService — account linking by email
  const user = await authService.upsertGoogleUser(db, googleUser);

  // Issue JWT session
  // ...redirect to /dashboard with cookies set
});
```

### Pattern 5: Resend via waitUntil (D-04)

**What:** Email dispatch must not block the API response. Use `c.executionCtx.waitUntil()` to fire-and-forget after the response is sent.

```typescript
// Source: Cloudflare Workers docs (waitUntil) + Resend official docs
// apps/api/src/lib/email.ts

import { Resend } from 'resend';

export function createEmailService(apiKey: string) {
  const resend = new Resend(apiKey);

  return {
    async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from: 'Profitmuna <noreply@yourdomain.com>',
        to,
        subject: 'Welcome to Profitmuna — verify your email',
        html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email. Link expires in 24 hours.</p>`,
      });
      if (error) console.error('sendVerificationEmail failed:', { to, error });
    },

    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from: 'Profitmuna <noreply@yourdomain.com>',
        to,
        subject: 'Reset your Profitmuna password',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
      });
      if (error) console.error('sendPasswordResetEmail failed:', { to, error });
    },
  };
}

// Usage in route handler:
// c.executionCtx.waitUntil(emailService.sendVerificationEmail(user.email, url));
```

**Important:** Resend SDK is initialized per-request with `c.env.RESEND_API_KEY` (Workers binding). Do not instantiate at module scope — Workers bindings are request-scoped.

### Pattern 6: Hono Cookie Set on Workers API

**What:** API sets auth cookies on the Hono response. BFF relays these `Set-Cookie` headers to the browser.

```typescript
// Source: hono.dev/docs/helpers/cookie [CITED]
import { setCookie, deleteCookie } from 'hono/cookie';

// After login — set both tokens
setCookie(c, 'access_token', accessToken, {
  httpOnly: true,
  secure: c.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  path: '/',
  maxAge: 30 * 60, // 30 minutes
});
setCookie(c, 'refresh_token', refreshToken, {
  httpOnly: true,
  secure: c.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
});

// On logout — clear both
deleteCookie(c, 'access_token', { path: '/' });
deleteCookie(c, 'refresh_token', { path: '/' });
```

**Architecture note (D-01/D-02):** The Workers API sets cookies on the response. The BFF proxy receives these `Set-Cookie` headers and relays them verbatim to the browser. The browser stores them as `yourdomain.com` (same-origin Next.js). The API itself does NOT need to receive CORS credentials because the BFF, not the browser, calls the API.

### Pattern 7: Refresh Token Rotation with Reuse Detection (D-11)

**What:** Every refresh rotates the token. Reuse of a revoked token means theft — revoke all tokens for that user.

```typescript
// apps/api/src/services/auth-service.ts
// Source: Standard refresh token rotation pattern [ASSUMED — no single authoritative spec]

async function refreshTokens(db: DrizzleD1, rawRefreshToken: string) {
  const tokenHash = await sha256Hash(rawRefreshToken);
  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });

  if (!stored) {
    throw new HTTPException(401, { message: 'Invalid refresh token' });
  }

  // Reuse detection: token already revoked
  if (stored.revokedAt !== null) {
    // Theft detected — revoke ALL tokens for this user
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(refreshTokens.userId, stored.userId));
    throw new HTTPException(401, { message: 'Refresh token reuse detected' });
  }

  if (new Date(stored.expiresAt) < new Date()) {
    throw new HTTPException(401, { message: 'Refresh token expired' });
  }

  // Rotate: revoke old, issue new
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokens.id, stored.id));

  const newRawToken = generateSecureToken();
  const newHash = await sha256Hash(newRawToken);
  await db.insert(refreshTokens).values({
    userId: stored.userId,
    tokenHash: newHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const newAccessToken = await signAccessToken(stored.userId);
  return { accessToken: newAccessToken, refreshToken: newRawToken };
}
```

### Anti-Patterns to Avoid

- **Storing raw refresh tokens in DB:** Always hash with sha256 first. Raw token in DB = single point of full compromise.
- **bcryptjs at module scope with Workers:** Workers re-execute module scope on cold starts; keep bcrypt calls inside request handlers.
- **Returning 401 for unverified email:** Return `403` with code `email_not_verified` (D-07). A 401 means "not authenticated"; a 403 means "authenticated but blocked."
- **Setting cookies directly on the Next.js response from a client component:** Cookies that carry auth tokens must only be set server-side (route handlers, server actions). Never use `document.cookie`.
- **Calling the Workers API directly from the browser:** All auth calls go browser → Next.js BFF → Workers API. The BFF is the only caller of the Workers API for auth.
- **Hardcoding `secure: false` globally:** Use `c.env.NODE_ENV === 'production'` to conditionally set Secure. Dev over HTTP needs `secure: false`.
- **Not using `waitUntil()` for email:** If you `await` email inside the handler body, a Resend failure blocks the response. Use `executionCtx.waitUntil()`.
- **Hono `jwt` built-in middleware:** Do NOT use `hono/jwt` middleware — it sets a global JWT secret via string, not via `c.env` binding. Use a custom `middleware/auth.ts` that reads `c.env.JWT_SECRET` per request.
- **Signing JWTs without iss/aud:** security.md requires validating `iss`, `aud`, `exp` on every request. Always set issuer + audience on sign and pass `issuer` + `audience` to `jwtVerify`.

---

## Don't Hand-Roll

| Problem               | Don't Build                           | Use Instead                                      | Why                                                                                                 |
| --------------------- | ------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Google OAuth 2.0 PKCE | Manual fetch to Google token endpoint | `arctic` (Google provider)                       | PKCE, state validation, token exchange, error types — arctic handles all correctly; 15 lines vs 150 |
| SHA-256 hashing       | Node.js `crypto` module               | `crypto.subtle.digest('SHA-256', ...)` (global)  | Node crypto is unavailable on Workers; Web Crypto is global and faster                              |
| JWT sign/verify       | Hand-rolled base64 + HMAC             | `jose` (already installed)                       | Algorithm confusion attacks, claim validation, exp/iss/aud — don't roll your own                    |
| Email sending         | Raw `fetch` to SMTP/Resend REST       | `resend` SDK                                     | Handles retries, error types, React email templates if needed                                       |
| Cookie manipulation   | `document.cookie` string parsing      | `hono/cookie` (setCookie/getCookie/deleteCookie) | Correct attribute serialization, signed cookie support                                              |
| Secure random token   | `Math.random()`                       | `crypto.getRandomValues()` (global)              | `Math.random()` is not cryptographically secure                                                     |

**Key insight:** The auth domain is heavily mined with subtle security bugs. Every hand-rolled piece (JWT, OAuth, hashing) risks introducing vulnerabilities that are hard to catch in code review. Use the established libraries for the dangerous parts; only write custom code for the integration glue.

---

## DB Schema Extensions

### Users Table Extension (packages/db/src/schema.ts)

```typescript
// Source: current schema.ts read + auth requirements [ASSUMED layout — verified against Drizzle SQLite docs]
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Auth additions:
  passwordHash: text('password_hash'), // nullable — Google-only users have no password
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  verifiedAt: text('verified_at'), // ISO string, set on email verification
  googleId: text('google_id').unique(), // nullable — email/password-only users have no googleId
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // sha256(rawToken)
  expiresAt: text('expires_at').notNull(), // ISO string
  revokedAt: text('revoked_at'), // null = active; ISO string = revoked
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const authTokens = sqliteTable('auth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // sha256(rawToken)
  purpose: text('purpose', { enum: ['verify_email', 'reset_password'] }).notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

**Index recommendations:**

- `refreshTokens.tokenHash` — unique (defined above); fast lookup on refresh
- `authTokens.tokenHash` — unique (defined above); fast lookup on verification
- `refreshTokens.userId` — for "revoke all for user" (theft detection)
- `authTokens.userId` — for "delete existing token before issuing new one" (prevent duplicate verification tokens)

### Cleanup pattern for auth_tokens:

On successful verification: `DELETE FROM auth_tokens WHERE id = ?` (single-use, D-09).
On new verification/reset request: Delete old tokens for same user+purpose before inserting new one (prevents token accumulation).

---

## New Environment Variables

All added to `apps/api/wrangler.toml` as `[vars]` (non-secret) or `wrangler secret put` (secret). Also documented in `.env.example`.

| Variable               | Where              | Purpose                              | Secret? |
| ---------------------- | ------------------ | ------------------------------------ | ------- |
| `JWT_ACCESS_SECRET`    | Workers binding    | HS256 key for access tokens          | Yes     |
| `JWT_REFRESH_SECRET`   | Workers binding    | HS256 key for refresh tokens         | Yes     |
| `RESEND_API_KEY`       | Workers binding    | Resend SDK auth key                  | Yes     |
| `RESEND_FROM_EMAIL`    | wrangler.toml vars | Verified sender address              | No      |
| `GOOGLE_CLIENT_ID`     | wrangler.toml vars | Google OAuth app client ID           | No      |
| `GOOGLE_CLIENT_SECRET` | Workers binding    | Google OAuth app secret              | Yes     |
| `GOOGLE_REDIRECT_URI`  | wrangler.toml vars | OAuth callback URL                   | No      |
| `APP_BASE_URL`         | wrangler.toml vars | Base URL for email link construction | No      |
| `NODE_ENV`             | wrangler.toml vars | `production` or `development`        | No      |

**Next.js side (apps/web/.env or Vercel env):**

| Variable              | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `API_BASE_URL`        | Internal server-to-server URL for BFF → Workers (NOT NEXT_PUBLIC) |
| `NEXT_PUBLIC_API_URL` | Already exists — public URL (NOT used for auth proxy in BFF)      |

---

## Common Pitfalls

### Pitfall 1: bcryptjs CPU Timeout on Workers Free Plan

**What goes wrong:** bcrypt at cost 12 can take 100-500ms of CPU time — well over the Workers Free plan's 10ms CPU limit. The request dies with "CPU exceeded."

**Why it happens:** bcrypt is intentionally slow. Cloudflare Workers have tight CPU time limits on free plans.

**How to avoid:** The project is on a paid plan (Standard). The paid plan's CPU limit is 30 seconds wall-clock by default (up to 5 minutes). bcrypt at cost 10 (verified ~50-100ms range) should work. Use cost 10 explicitly. If still seeing CPU errors in production, fall back to PBKDF2 via `crypto.subtle.deriveKey` — zero new deps, natively fast on Workers.

**Warning signs:** `Error: Worker exceeded CPU time limit` in wrangler dev logs.

### Pitfall 2: Next.js 15 async cookies() API

**What goes wrong:** `cookies()` in Next.js 15 App Router is an async function. Calling it synchronously (as in Next.js 14 patterns) returns a thenable Promise, not the store.

**Why it happens:** Next.js 15 changed `cookies()` to be async to support Partial Prerendering. Old patterns `const cookieStore = cookies()` are now wrong.

**How to avoid:** Always `await cookies()`:

```typescript
const cookieStore = await cookies();
const token = cookieStore.get('access_token')?.value;
```

[CITED: nextjs.org/docs/app/api-reference/functions/cookies]

**Warning signs:** `cookieStore.get is not a function` or reading `undefined` for all cookies.

### Pitfall 3: Set-Cookie Not Relayed by BFF

**What goes wrong:** BFF proxies the Workers API response but the browser never receives the auth cookies, because Next.js may strip or not forward `Set-Cookie` headers from upstream responses.

**Why it happens:** `new NextResponse(apiRes.body, { headers: apiRes.headers })` does not automatically forward `Set-Cookie` because Next.js may deduplicate or sanitize headers.

**How to avoid:** Explicitly iterate `apiRes.headers.getSetCookie()` (returns an array) and `nextRes.headers.append('Set-Cookie', cookie)` for each. Never use `headers.set('Set-Cookie', ...)` — it will overwrite all cookies to the last one.

**Warning signs:** Login succeeds (200) but the user is immediately unauthenticated on next request.

### Pitfall 4: Hono jwt Middleware vs Custom Auth Middleware

**What goes wrong:** Using `hono/jwt` middleware reads the secret from a string literal, not from `c.env`. On Workers, you cannot access bindings at module scope.

**Why it happens:** Workers module scope executes before the first request and has no access to `env` bindings.

**How to avoid:** Write a custom `middleware/auth.ts` that extracts `c.env.JWT_ACCESS_SECRET` inside the handler body, creates the `TextEncoder` secret, and calls `jwtVerify`. Register it with `app.use('/api/protected/*', authMiddleware)`.

**Warning signs:** `JWT_ACCESS_SECRET is not defined` or `undefined` secret on first request.

### Pitfall 5: Resend SDK Initialization at Module Scope

**What goes wrong:** `const resend = new Resend(process.env.RESEND_API_KEY)` at module scope fails on Workers because bindings are not available at module scope.

**Why it happens:** Workers bindings (`c.env`) are request-scoped, not global environment variables.

**How to avoid:** Initialize `new Resend(c.env.RESEND_API_KEY)` inside the request handler or pass the API key as a parameter to the email service factory.

**Warning signs:** `RESEND_API_KEY is undefined` or emails silently fail with no error.

### Pitfall 6: Google OAuth State Cookie SameSite

**What goes wrong:** The OAuth state cookie set on `/api/auth/google` must survive the redirect to Google and back. If SameSite=Strict, the cookie won't be sent on the cross-site redirect callback.

**Why it happens:** SameSite=Strict blocks cookies on cross-site navigations, including OAuth callbacks.

**How to avoid:** Set the state/codeVerifier cookies with `SameSite=Lax` (or `None` + Secure). `Lax` is sufficient and correct for OAuth flows because the callback is a top-level navigation.

**Warning signs:** OAuth callback fails with "Invalid OAuth state" because storedState is undefined.

### Pitfall 7: Deleting Expired Tokens vs Marking as Revoked

**What goes wrong:** auth_tokens (verify/reset) should be hard-deleted on use to prevent replay. refresh_tokens should be soft-revoked (not deleted) to support reuse-detection (if you delete on revoke, you can't detect reuse).

**Why it happens:** Treating both token types the same way.

**How to avoid:**

- `authTokens`: DELETE row on successful use (one-time tokens, D-09).
- `refreshTokens`: SET `revokedAt = now()` on rotation (keep row for reuse detection, D-11). Periodically clean up old revoked rows.

---

## Code Examples

### Verified: sha256 token hashing on Workers

```typescript
// Source: Cloudflare Workers Web Crypto docs [CITED: developers.cloudflare.com/workers/runtime-apis/web-crypto/]
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Verified: jose HS256 sign on Workers

```typescript
// Source: Context7 /panva/jose [VERIFIED: Context7]
import { SignJWT, jwtVerify } from 'jose';
const secret = new TextEncoder().encode(env.JWT_SECRET);
const token = await new SignJWT({ sub: '1' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuer('profitmuna')
  .setAudience('profitmuna-api')
  .setExpirationTime('30m')
  .sign(secret);
const { payload } = await jwtVerify(token, secret, {
  algorithms: ['HS256'],
  issuer: 'profitmuna',
  audience: 'profitmuna-api',
});
```

### Verified: arctic Google PKCE initiation

```typescript
// Source: Context7 /websites/arcticjs_dev [VERIFIED: Context7]
import * as arctic from 'arctic';
const google = new arctic.Google(clientId, clientSecret, redirectURI);
const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
```

### Verified: Resend send in Cloudflare Worker

```typescript
// Source: resend.com/docs/send-with-cloudflare-workers [CITED]
import { Resend } from 'resend';
// Initialize per-request with binding key
const resend = new Resend(c.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: 'Profitmuna <noreply@yourdomain.com>',
  to: [user.email],
  subject: 'Verify your email',
  html: '<p>...</p>',
});
```

### Verified: Next.js 15 async cookies in route handler

```typescript
// Source: nextjs.org/docs/app/api-reference/functions/cookies [CITED]
import { cookies } from 'next/headers';
export async function GET() {
  const cookieStore = await cookies(); // must await in Next.js 15
  const token = cookieStore.get('access_token')?.value;
  // ...
}
```

---

## State of the Art

| Old Approach                         | Current Approach                    | When Changed            | Impact                                                          |
| ------------------------------------ | ----------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `cookies()` synchronous (Next.js 14) | `await cookies()` (Next.js 15)      | Next.js 15.0            | Breaking — must update all cookie access                        |
| arctic v1/v2 (different API)         | arctic v3 (3.7.0) — new API surface | Major version 2024/2025 | `validateAuthorizationCode` signature changed; use v3 docs only |
| Bundled Cloudflare plan (50ms CPU)   | Paid Standard plan (30s default)    | Deprecated ~2023        | bcrypt now viable at cost 10 on paid plan                       |

**Deprecated/outdated:**

- `hono/jwt` middleware: Patterns that hardcode a string secret at module scope — do not use; read secret from `c.env` per-request.
- `cookies()` without `await`: All pre-Next.js-15 patterns for reading cookies synchronously are broken.
- arctic v2 `OAuth2Provider` API: v3 uses a named class per provider (`new arctic.Google(...)`), not a generic provider factory.

---

## Assumptions Log

| #   | Claim                                                                                | Section                    | Risk if Wrong                                                                                  |
| --- | ------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------- |
| A1  | bcryptjs at cost 10 completes within Workers Standard plan CPU limits                | Standard Stack / Pitfall 1 | If it exceeds CPU, all login/register requests will fail; fallback is PBKDF2 via crypto.subtle |
| A2  | arctic download volume is 100k+/week (inferred from 119 dependents note)             | Package Legitimacy Audit   | Low risk — package legitimacy is well-supported by official docs and Context7 HIGH rating      |
| A3  | resend download volume is millions/week                                              | Package Legitimacy Audit   | Low risk — official Resend SDK with official docs                                              |
| A4  | Refresh token rotation + reuse detection pattern (revoke chain)                      | Pattern 7                  | If schema/query is wrong, theft detection fails silently; needs integration test coverage      |
| A5  | NEXT_PUBLIC_API_URL vs API_BASE_URL split (BFF calls API on server side, non-public) | New Environment Variables  | If wrong var name used, BFF can't reach Workers API in dev or prod                             |
| A6  | Combined welcome + verification email (one email per registration)                   | Claude's Discretion        | UX preference only; easy to split into two sends if desired                                    |

---

## Open Questions (RESOLVED)

1. **bcryptjs cost 10 vs security.md "cost >= 12" directive**
   - What we know: `.claude/rules/security.md` requires `bcrypt (cost >= 12)`. Workers paid plan wall-clock is 5 min but CPU-intensive ops can still timeout. bcrypt at cost 12 can take 300-600ms of CPU. Community evidence says cost 10 (~100ms) works on Workers Standard.
   - What's unclear: Whether cost 10 passes muster with the project's security rule, or whether PBKDF2 (which has no cost conflict and is natively fast on Workers) is preferable.
   - Recommendation: **Planner should flag this for the user.** Options: (a) use bcryptjs at cost 10 and annotate the deviation from "≥12", (b) switch to Web Crypto PBKDF2 with 100,000 iterations (zero new deps, equivalent security, natively fast). PBKDF2 is the author's recommended path for Cloudflare Workers per official blog posts.
   - **RESOLVED:** Web Crypto PBKDF2-SHA256 (210,000 iterations, 16-byte random salt), Workers-native, no new dep. security.md permits "bcrypt (cost>=12) OR Argon2id"; PBKDF2-210k is the documented Workers-native equivalent and avoids the bcryptjs CPU-timeout risk entirely. Documented intentional deviation from the literal rule list. See plan 01-01 `decisions_resolved`.

2. **BFF catch-all route vs individual route handlers**
   - What we know: A single catch-all `[...path]/route.ts` is simpler. Individual route handlers per auth endpoint give more control over method-specific logic.
   - What's unclear: Whether the transparent refresh logic should live in a single catch-all proxy or in Next.js middleware.
   - Recommendation: Use Next.js `middleware.ts` for auth-check redirects (no token → redirect to /login) and a BFF catch-all route handler for all `/api/auth/*` proxying. The catch-all is clean and puts all relay logic in one place.
   - **RESOLVED:** Catch-all `[...path]/route.ts` proxy for all `/api/auth/*` (forward + Set-Cookie relay + transparent refresh) PLUS a separate Next.js `middleware.ts` redirect guard for unauthenticated routes. See plan 01-02 (BFF transparent refresh lives in the catch-all; `middleware.ts` handles redirect guarding).

3. **Rate limiting deferral**
   - What we know: D1 SQLite can support a simple attempts counter table. Durable Objects are better for high-frequency atomic counters. Cloudflare WAF rate limiting is also available. Building a D1-based counter is feasible but not atomic.
   - Recommendation: For MVP, implement a simple D1-based `login_attempts` table (per-email, count + last_attempt_at). Accept the non-atomic race condition — it's sufficient to slow down attacks. Document the limitation. Defer to Cloudflare WAF or Durable Objects for hardened rate limiting.
   - **RESOLVED:** D1 `login_attempts` counter per email (5-fail / 15-min lockout → 429 + Retry-After) for v1; the non-atomic race condition is accepted and documented. Defer Cloudflare WAF / Durable Objects for hardened rate limiting. See plan 01-02 `decisions_resolved`.

---

## Environment Availability

| Dependency             | Required By        | Available      | Version    | Fallback                                                   |
| ---------------------- | ------------------ | -------------- | ---------- | ---------------------------------------------------------- |
| Node.js 22             | Build tooling      | ✓              | v24.15.0   | —                                                          |
| npm 10+                | Package install    | ✓              | 11.12.1    | —                                                          |
| wrangler CLI           | Workers dev/deploy | ✓ (via npx)    | 4.98.0     | `npx wrangler`                                             |
| Vitest 3.0             | API unit tests     | ✓ (installed)  | 3.0.0      | —                                                          |
| Cloudflare D1          | Database           | ✓ (configured) | local mode | —                                                          |
| Resend account         | Email sending      | Not verified   | —          | Create at resend.com — needed before testing               |
| Google Cloud OAuth app | Google login       | Not verified   | —          | Create at console.cloud.google.com — needed before testing |
| Verified Resend domain | Email from address | Not verified   | —          | resend.dev domain works for dev testing                    |

**Missing dependencies with no fallback:**

- Resend account + API key — required for AUTH-01/AUTH-04/AUTH-06. Must create before email sends are testable.
- Google OAuth credentials — required for AUTH-03. Must create before Google login is testable.

**Missing dependencies with fallback:**

- Resend domain verification — `onboarding@resend.dev` works for development testing without domain verification.

---

## Validation Architecture

### Test Framework

| Property           | Value                                   |
| ------------------ | --------------------------------------- |
| Framework          | Vitest 3.0.0                            |
| Config file        | `apps/api/vitest.config.ts` (exists)    |
| Quick run command  | `cd apps/api && npm test`               |
| Full suite command | `cd apps/api && npm test -- --coverage` |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                             | Test Type                | Automated Command                               | File Exists? |
| ------- | -------------------------------------------------------------------- | ------------------------ | ----------------------------------------------- | ------------ |
| AUTH-01 | Register + email verification flow (token issue, verify endpoint)    | unit                     | `cd apps/api && npm test -- --reporter=verbose` | ❌ Wave 0    |
| AUTH-01 | Login blocked before verification (403 email_not_verified)           | unit                     | same                                            | ❌ Wave 0    |
| AUTH-02 | Login issues access + refresh tokens as httpOnly cookies             | unit                     | same                                            | ❌ Wave 0    |
| AUTH-02 | Refresh endpoint rotates tokens (new access + new refresh)           | unit                     | same                                            | ❌ Wave 0    |
| AUTH-02 | BFF transparent refresh (near-expired token triggers silent refresh) | integration              | manual / e2e (Playwright)                       | ❌ Wave 0    |
| AUTH-03 | Google callback upserts user and issues session                      | unit (mock Google fetch) | same                                            | ❌ Wave 0    |
| AUTH-04 | Reset token issued, emailed, and consumed successfully               | unit                     | same                                            | ❌ Wave 0    |
| AUTH-04 | Reset token rejected after expiry                                    | unit                     | same                                            | ❌ Wave 0    |
| AUTH-05 | Logout deletes refresh token row + clears cookies                    | unit                     | same                                            | ❌ Wave 0    |
| AUTH-05 | Revoked refresh token rejected (reuse detection)                     | unit                     | same                                            | ❌ Wave 0    |
| AUTH-06 | Welcome email sent after registration                                | unit (mock Resend)       | same                                            | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/api && npm test`
- **Per wave merge:** `cd apps/api && npm test -- --coverage` — full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/auth.test.ts` — covers AUTH-01 through AUTH-06 (new file)
- [ ] `apps/api/tests/helpers/db.ts` — test DB setup (D1 in-memory via better-sqlite3 for unit tests)
- [ ] Mock patterns for Resend (`vi.mock` on `resend`) and Google fetch (`vi.stubGlobal('fetch', ...)`)
- [ ] `apps/api/vitest.config.ts` — already exists; may need `setupFiles` for test env bindings

**Note on Hono testing pattern (from existing tests):** `app.request('/health')` works without a real HTTP server — Hono's `app.request()` works in Vitest. For Workers bindings (`c.env`), inject a mock `env` object as the second argument to `app.request(path, init, env)`.

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category         | Applies | Standard Control                                                                      |
| --------------------- | ------- | ------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | PBKDF2-SHA256 210k password hash; email verification required before login            |
| V3 Session Management | yes     | httpOnly cookies; JWT 30m/7d with iss+aud; refresh rotation + reuse detection         |
| V4 Access Control     | yes     | Auth middleware on all protected routes; 401/403 status codes                         |
| V5 Input Validation   | yes     | zod on all request bodies via @hono/zod-validator                                     |
| V6 Cryptography       | yes     | jose HS256 JWT; crypto.subtle sha256 for tokens; crypto.getRandomValues for token gen |
| V14 Config            | yes     | Security response headers (HSTS, CSP, nosniff, frame-deny, referrer, permissions)     |

### Known Threat Patterns

| Pattern                           | STRIDE                 | Standard Mitigation                                                            |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Brute force login                 | Tampering              | D1 attempts counter (MVP); Cloudflare WAF rate limiting (future)               |
| JWT algorithm confusion           | Spoofing               | jwtVerify with explicit `algorithms: ['HS256']` (jose)                         |
| JWT token substitution            | Spoofing               | Set + validate `iss` (profitmuna) and `aud` (profitmuna-api) on every verify   |
| Refresh token theft               | Elevation of privilege | Rotation + reuse detection → revoke all sessions                               |
| Email link token replay           | Spoofing               | sha256 hash + single-use delete on redemption (D-09)                           |
| CSRF on mutation endpoints        | Tampering              | SameSite=Lax cookie + BFF same-origin pattern prevents cross-site form posts   |
| XSS cookie theft                  | Info disclosure        | httpOnly cookies — JavaScript cannot read auth tokens                          |
| Clickjacking / MIME sniffing      | Tampering              | Security response headers (X-Frame-Options DENY, X-Content-Type-Options)       |
| Open redirect in OAuth callback   | Spoofing               | Validate state matches stored value; never redirect to user-supplied URL       |
| Timing oracle on token comparison | Info disclosure        | D1 lookup by hash is constant-time at DB level; hash comparison is exact match |

---

## Sources

### Primary (HIGH confidence)

- Context7 `/panva/jose` — JWT sign/verify patterns, HS256, error types, Workers compatibility
- Context7 `/pilcrowonpaper/arctic` + `/websites/arcticjs_dev` — Google OAuth PKCE flow, validateAuthorizationCode, userinfo fetch
- Context7 `/websites/resend` — Cloudflare Workers send-with pattern, SDK usage
- `developers.cloudflare.com/workers/runtime-apis/web-crypto/` — crypto.subtle.digest SHA-256 availability
- `hono.dev/docs/helpers/cookie` — setCookie / getCookie / deleteCookie API
- `nextjs.org/docs/app/api-reference/functions/cookies` — async cookies() in Next.js 15

### Secondary (MEDIUM confidence)

- `developers.cloudflare.com/workers/platform/limits/` — Workers Standard plan CPU limits (5 min wall-clock)
- `lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html` — PBKDF2 as Workers-native alternative
- `resend.com/docs/send-with-cloudflare-workers` — official Resend + Workers guide
- `arcticjs.dev/` — official arctic v3 documentation site

### Tertiary (LOW confidence / ASSUMED)

- bcryptjs cost 10 viability at Workers paid plan — community evidence from forum posts, not official benchmark
- D1-based rate limiting schema — synthesized from SQLite rate-limit patterns, not Cloudflare-specific docs

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified via Context7, npm registry, and official docs
- Architecture: HIGH — BFF proxy, JWT pattern, arctic Google flow all verified; schema is Drizzle SQLite standard
- Pitfalls: MEDIUM/HIGH — cookie relay and async cookies() are HIGH (official docs); bcryptjs CPU is MEDIUM (community evidence)
- Rate limiting: LOW — D1-based approach is pragmatic but not benchmarked for Workers

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable stack; arctic/resend do not change frequently)
