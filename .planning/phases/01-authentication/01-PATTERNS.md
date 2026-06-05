# Phase 1: Authentication - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 21 new/modified files
**Analogs found:** 6 / 21 (codebase is early-stage skeleton; most auth files are net-new)

---

## Repo State Note

This repo has only 5 non-config source files today:

| File                           | What it establishes                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| `apps/api/src/index.ts`        | Hono app init pattern, `Bindings` type, CORS, thin route handlers |
| `apps/api/tests/index.test.ts` | Vitest test structure, `app.request()` pattern                    |
| `apps/api/vitest.config.ts`    | Vitest config with `@/*` alias                                    |
| `packages/db/src/schema.ts`    | Drizzle `sqliteTable` pattern, ISO-string timestamps              |
| `packages/db/src/index.ts`     | `createDb()` factory, `schema` re-export                          |
| `apps/web/src/lib/utils.ts`    | `cn()` utility (clsx + tailwind-merge)                            |
| `apps/web/src/app/layout.tsx`  | Next.js App Router root layout, default export, `import type`     |
| `apps/web/src/app/page.tsx`    | Next.js page (Server Component), Tailwind className usage         |

No existing routes, services, schemas, middleware, or auth screens exist. Every auth file is net-new. The patterns below extract every usable convention from the existing files and supplement with the verified reference patterns from RESEARCH.md for the rest.

---

## File Classification

| New/Modified File                                     | Role                  | Data Flow        | Closest Analog                         | Match Quality                                 |
| ----------------------------------------------------- | --------------------- | ---------------- | -------------------------------------- | --------------------------------------------- |
| `packages/db/src/schema.ts` _(extend)_                | model                 | CRUD             | itself (extend)                        | self                                          |
| `apps/api/src/index.ts` _(extend)_                    | config/entrypoint     | request-response | itself (extend)                        | self                                          |
| `apps/api/src/routes/auth.ts`                         | route                 | request-response | `apps/api/src/index.ts`                | partial (same Hono app, no route file analog) |
| `apps/api/src/services/auth-service.ts`               | service               | CRUD             | none                                   | net-new                                       |
| `apps/api/src/schemas/auth.ts`                        | schema/validation     | transform        | none                                   | net-new                                       |
| `apps/api/src/middleware/auth.ts`                     | middleware            | request-response | `apps/api/src/index.ts` (`cors` usage) | partial                                       |
| `apps/api/src/lib/jwt.ts`                             | utility               | transform        | none                                   | net-new                                       |
| `apps/api/src/lib/token.ts`                           | utility               | transform        | none                                   | net-new                                       |
| `apps/api/src/lib/email.ts`                           | utility               | request-response | none                                   | net-new                                       |
| `apps/api/src/types/index.ts`                         | types                 | —                | none                                   | net-new                                       |
| `apps/web/src/app/api/auth/[...path]/route.ts`        | route (BFF proxy)     | request-response | none                                   | net-new                                       |
| `apps/web/src/app/(auth)/login/page.tsx`              | component/page        | request-response | `apps/web/src/app/page.tsx`            | role-match                                    |
| `apps/web/src/app/(auth)/register/page.tsx`           | component/page        | request-response | `apps/web/src/app/page.tsx`            | role-match                                    |
| `apps/web/src/app/(auth)/verify-email/page.tsx`       | component/page        | request-response | `apps/web/src/app/page.tsx`            | role-match                                    |
| `apps/web/src/app/(auth)/forgot-password/page.tsx`    | component/page        | request-response | `apps/web/src/app/page.tsx`            | role-match                                    |
| `apps/web/src/app/(auth)/reset-password/page.tsx`     | component/page        | request-response | `apps/web/src/app/page.tsx`            | role-match                                    |
| `apps/web/src/components/auth/LoginForm.tsx`          | component             | request-response | none                                   | net-new                                       |
| `apps/web/src/components/auth/RegisterForm.tsx`       | component             | request-response | none                                   | net-new                                       |
| `apps/web/src/components/auth/ForgotPasswordForm.tsx` | component             | request-response | none                                   | net-new                                       |
| `apps/web/src/components/auth/ResetPasswordForm.tsx`  | component             | request-response | none                                   | net-new                                       |
| `apps/web/src/server/auth.ts`                         | service (server-only) | request-response | none                                   | net-new                                       |
| `apps/web/src/middleware.ts`                          | middleware            | request-response | none                                   | net-new                                       |
| `apps/api/tests/auth.test.ts`                         | test                  | —                | `apps/api/tests/index.test.ts`         | role-match                                    |

---

## Pattern Assignments

### `packages/db/src/schema.ts` (extend — model, CRUD)

**Analog:** itself

**Current file** (`packages/db/src/schema.ts`, lines 1–8):

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

**Established conventions to copy:**

- ISO string for all timestamps (not `integer` unix epoch) — use `text('col').$defaultFn(() => new Date().toISOString())`
- Named exports per table (`export const tableName`)
- snake_case column names, camelCase TS property names
- `integer('id').primaryKey({ autoIncrement: true })` for all PKs
- `text('col').notNull().unique()` for unique string columns
- Nullable columns: omit `.notNull()` (no explicit `.nullable()` in the existing pattern)

**New tables to add** (RESEARCH.md `## DB Schema Extensions`, lines 622–659):

```typescript
// Extend users with auth columns:
passwordHash: text('password_hash'),            // nullable — Google-only users
emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
verifiedAt: text('verified_at'),                // nullable ISO string
googleId: text('google_id').unique(),           // nullable

// New table: refresh_tokens
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),                // null = active; ISO string = revoked
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

// New table: auth_tokens (email verification + password reset)
export const authTokens = sqliteTable('auth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  purpose: text('purpose', { enum: ['verify_email', 'reset_password'] }).notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

---

### `apps/api/src/index.ts` (extend — config/entrypoint)

**Analog:** itself

**Current file** (`apps/api/src/index.ts`, lines 1–20):

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Profitmuna Main API' });
});

export default app;
```

**What to extend:**

- Add all new auth environment bindings to the `Bindings` type before mounting routes
- Mount the auth router: `app.route('/api/auth', authRouter)`
- The `export default app` stays at the bottom — Workers entry point requirement
- Keep `app.use('/*', cors())` as-is; auth routes do not need CORS credentials (D-02, BFF handles same-origin)

**Bindings additions to add** (RESEARCH.md `## New Environment Variables`):

```typescript
type Bindings = {
  DB: D1Database;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  APP_BASE_URL: string;
  NODE_ENV: string;
};
```

---

### `apps/api/src/routes/auth.ts` (route, request-response)

**Analog:** `apps/api/src/index.ts` (partial — same Hono conventions)

**Hono router pattern** (extract from `apps/api/src/index.ts`, lines 1–20):

```typescript
// Thin router file — validate → call service → return response
// No business logic here
import { Hono } from 'hono';
import type { Bindings } from '@/types'; // use @/* alias, not relative

const authRouter = new Hono<{ Bindings: Bindings }>();

// Pattern: handler shape from existing index.ts
authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  // ...validate (done by middleware), call service, return c.json(...)
});

export { authRouter };
```

**Key rules from CLAUDE.md + api-routes.md:**

- Named export (`export { authRouter }`) — default exports only for Next.js page/layout files
- Use `@/*` path alias, never `../../../`
- Keep handlers ≤20 lines — validate, call service, return
- Error shape: `{ error: { code, message, details? } }` — throw `HTTPException` for expected errors
- Auth guard middleware registered on protected sub-paths, not per-handler
- Status codes: 201 for creation, 200 for reads, 422 for validation errors, 401/403 for auth errors

**Hono cookie helper** (RESEARCH.md Pattern 6):

```typescript
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';

setCookie(c, 'access_token', accessToken, {
  httpOnly: true,
  secure: c.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  path: '/',
  maxAge: 30 * 60,
});
```

**Arctic Google OAuth route shape** (RESEARCH.md Pattern 4, lines 395–464):

```typescript
import * as arctic from 'arctic';

authRouter.get('/google', (c) => {
  const google = new arctic.Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    c.env.GOOGLE_REDIRECT_URI
  );
  const state = arctic.generateState();
  const codeVerifier = arctic.generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
  // State/verifier cookies: SameSite=Lax (not Strict — must survive cross-site OAuth redirect)
  setCookie(c, 'oauth_state', state, { httpOnly: true, sameSite: 'Lax', maxAge: 600, path: '/' });
  setCookie(c, 'oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });
  return c.redirect(url.toString());
});
```

---

### `apps/api/src/services/auth-service.ts` (service, CRUD)

**Analog:** none — net-new

**Pattern source:** RESEARCH.md Pattern 7 (refresh token rotation) + CLAUDE.md service constraints

**Service shape rule** (from CLAUDE.md + api-routes.md):

```typescript
// Services are framework-agnostic: NO c.req, c.json, c.env, setCookie
// Accept typed parameters; return typed results; throw HTTPException for expected errors
// Access DB via createDb(d1) passed in from the route handler

import { createDb } from '@app/db';
import type { D1Database } from '@cloudflare/workers-types';

export async function register(
  d1: D1Database,
  input: { email: string; name: string; password: string }
): Promise<{ userId: number }> {
  const db = createDb(d1);
  // ... business logic
}
```

**Refresh token rotation pattern** (RESEARCH.md Pattern 7, lines 542–588):

```typescript
// Reuse detection: if revokedAt is set, revoke ALL tokens for the user (theft)
if (stored.revokedAt !== null) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokens.userId, stored.userId));
  throw new HTTPException(401, { message: 'Refresh token reuse detected' });
}
```

**Email dispatch** (use `waitUntil` — not `await` in handler body):

```typescript
// Route handler calls:
c.executionCtx.waitUntil(emailService.sendVerificationEmail(user.email, verifyUrl));
// Never: await emailService.send(...) blocking the response
```

---

### `apps/api/src/schemas/auth.ts` (schema/validation, transform)

**Analog:** none — net-new

**Pattern source:** CLAUDE.md (`@hono/zod-validator`, Zod 4), RESEARCH.md Standard Stack

```typescript
// Named exports, one schema per endpoint payload
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8), // D-discretion: 8-char minimum
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
```

**Usage in route** (zValidator from `@hono/zod-validator`):

```typescript
import { zValidator } from '@hono/zod-validator';
import { registerSchema } from '@/schemas/auth';

authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json'); // fully typed, already validated
  // ...
});
```

---

### `apps/api/src/middleware/auth.ts` (middleware, request-response)

**Analog:** `apps/api/src/index.ts` line 10 (`app.use('/*', cors())`) — partial, shows Hono middleware registration

**Pattern source:** RESEARCH.md Pitfall 4 (do NOT use `hono/jwt` — use custom middleware reading `c.env` per-request)

```typescript
// apps/api/src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { jwtVerify } from 'jose';
import type { Bindings } from '@/types';

export const requireAuth = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  // Read secret from c.env — NEVER at module scope (Workers binding is request-scoped)
  const secret = new TextEncoder().encode(c.env.JWT_ACCESS_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    c.set('userId', Number(payload.sub));
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }
  await next();
});
```

**Registration in route file** (not in index.ts — scoped to protected routes):

```typescript
authRouter.use('/me', requireAuth);
authRouter.use('/logout', requireAuth);
```

---

### `apps/api/src/lib/jwt.ts` (utility, transform)

**Analog:** none — net-new

**Pattern source:** RESEARCH.md Pattern 2 (jose HS256, lines 328–358)

```typescript
// apps/api/src/lib/jwt.ts
// Pure functions; caller passes the secret string from c.env
import { SignJWT, jwtVerify, JWTExpired } from 'jose';

export async function signAccessToken(userId: number, secret: string): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(new TextEncoder().encode(secret));
}

export async function signRefreshToken(userId: number, secret: string): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(token: string, secret: string) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ['HS256'], // explicit allowlist prevents alg confusion
  });
  return payload;
}

export { JWTExpired }; // re-export for error handling in callers
```

---

### `apps/api/src/lib/token.ts` (utility, transform)

**Analog:** none — net-new

**Pattern source:** RESEARCH.md Pattern 3 (Web Crypto sha256, lines 367–389)

```typescript
// apps/api/src/lib/token.ts
// Uses Web Crypto globals (available on all Cloudflare Workers runtimes)
// No Node crypto — Workers does not have it

export function encodeHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSecureToken(): string {
  // 32 random bytes → 64 hex chars; raw token goes in email link
  return encodeHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

export async function sha256Hash(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return encodeHex(hashBuffer);
}
```

**Usage contract (D-09):**

- `generateSecureToken()` → raw token → goes in email link URL
- `sha256Hash(rawToken)` → stored in `auth_tokens.token_hash` or `refresh_tokens.token_hash`
- On redemption: hash the incoming value, query DB by hash, check expiry, delete/revoke row

---

### `apps/api/src/lib/email.ts` (utility, request-response)

**Analog:** none — net-new

**Pattern source:** RESEARCH.md Pattern 5 (Resend + waitUntil, lines 469–505)

```typescript
// apps/api/src/lib/email.ts
// Factory function — accepts RESEND_API_KEY from c.env (never module scope)
import { Resend } from 'resend';

export function createEmailService(apiKey: string, fromEmail: string) {
  const resend = new Resend(apiKey);

  return {
    async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from: `Profitmuna <${fromEmail}>`,
        to,
        subject: 'Welcome to Profitmuna — verify your email',
        html: `<p>Click <a href="${verifyUrl}">here</a> to verify. Expires in 24 hours.</p>`,
      });
      if (error) console.error('sendVerificationEmail failed:', { to, error });
    },

    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from: `Profitmuna <${fromEmail}>`,
        to,
        subject: 'Reset your Profitmuna password',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset. Expires in 1 hour.</p>`,
      });
      if (error) console.error('sendPasswordResetEmail failed:', { to, error });
    },
  };
}
// Usage in route: c.executionCtx.waitUntil(emailService.sendVerificationEmail(...))
```

---

### `apps/api/src/types/index.ts` (types)

**Analog:** none — net-new

**Convention source:** CLAUDE.md TypeScript rules, `apps/api/src/index.ts` (inline `Bindings`)

```typescript
// apps/api/src/types/index.ts
// Move Bindings here once it grows beyond index.ts; re-export from index.ts

export type Bindings = {
  DB: D1Database;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  APP_BASE_URL: string;
  NODE_ENV: string;
};

// Hono context variable types (c.set / c.get)
export type Variables = {
  userId: number;
};
```

---

### `apps/web/src/app/api/auth/[...path]/route.ts` (BFF proxy, request-response)

**Analog:** none — net-new

**Pattern source:** RESEARCH.md Pattern 1 (BFF proxy with transparent refresh, lines 259–319)

**Critical Next.js 15 rules** (from RESEARCH.md Pitfall 2 + Pitfall 3):

```typescript
// apps/web/src/app/api/auth/[...path]/route.ts
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// cookies() is ASYNC in Next.js 15 — must await
const cookieStore = await cookies();
const accessToken = cookieStore.get('access_token')?.value;

// Set-Cookie relay: use .append() in a loop — never .set() (overwrites all but last)
for (const cookie of apiRes.headers.getSetCookie()) {
  nextRes.headers.append('Set-Cookie', cookie);
}
```

**File naming:** `route.ts` is the Next.js App Router convention for route handlers — default export (`export async function GET/POST`) required.

**Web layout context** (`apps/web/src/app/layout.tsx`, lines 1–19):

```typescript
// Default export — required by Next.js pages and route handlers
// import type for type-only imports
import type { Metadata } from 'next';
// No 'use client' — this is a server-side file
```

---

### `apps/web/src/app/(auth)/*/page.tsx` pages (component/page, request-response)

**Analog:** `apps/web/src/app/page.tsx` (role-match)

**Established page pattern** (`apps/web/src/app/page.tsx`, lines 1–11):

```typescript
// Server Component (no 'use client' directive)
// Default export — required by Next.js
// Tailwind className for all styling
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      {/* Tailwind utility classes only */}
    </main>
  );
}
```

**Auth page pattern:**

- Each page is a Server Component (no `'use client'`)
- Default export, named after the route (e.g., `LoginPage`, `RegisterPage`)
- Imports the corresponding `*Form` client component for interactive parts
- Route group `(auth)` means the folder is in the URL path structure but the group name itself is not in the URL

---

### `apps/web/src/components/auth/*.tsx` forms (component, request-response)

**Analog:** none — net-new (no components exist yet)

**Convention source:** CLAUDE.md component conventions, `apps/web/src/app/layout.tsx`

```typescript
// 'use client' required — form interaction needs client-side state
'use client';

import { useState } from 'react';
import { toast } from 'sonner'; // toast notifications per CLAUDE.md error handling
// shadcn/ui components from @/components/ui/*
// cn() from @/lib/utils

interface LoginFormProps {
  // Props interface: PascalCase suffix Props
}

// PascalCase component, named export (not default — shared components use named exports)
export function LoginForm({ ... }: LoginFormProps) {
  // useState for form state
  // fetch to /api/auth/login (same-origin BFF — never directly to Workers API)
  // toast.error(...) for user-facing errors (sonner)
}
```

**Import pattern from `apps/web/src/lib/utils.ts`** (lines 1–6):

```typescript
// External deps first, then internal packages, then relative
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
// @/* alias for same-package imports
import { cn } from '@/lib/utils';
```

---

### `apps/web/src/server/auth.ts` (server-only service, request-response)

**Analog:** none — net-new

**Convention source:** CLAUDE.md (`server/` = server-only modules), Next.js 15 async `cookies()`

```typescript
// apps/web/src/server/auth.ts
// Server-only — never import from client components
import { cookies } from 'next/headers';

export async function getSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies(); // async in Next.js 15
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  // Decode (not verify — API verifies; this is just for UI rendering)
  // Return minimal session shape
}
```

---

### `apps/web/src/middleware.ts` (middleware, request-response)

**Analog:** none — net-new

**Convention source:** CLAUDE.md (`middleware.ts` — Next.js middleware at `apps/web/src/middleware.ts`)

```typescript
// apps/web/src/middleware.ts — Next.js Edge Middleware
// NOT inside src/app/ — lives at src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith('/(auth)') ||
    ['/login', '/register', '/forgot-password'].includes(pathname);

  if (!token && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

### `apps/api/tests/auth.test.ts` (test)

**Analog:** `apps/api/tests/index.test.ts` (role-match — exact same test framework and pattern)

**Established test pattern** (`apps/api/tests/index.test.ts`, lines 1–18):

```typescript
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('API routes', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health'); // Hono app.request() — no real HTTP server
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
```

**Auth test extensions needed:**

- Inject mock `env` as third argument to `app.request(path, init, mockEnv)` for Workers bindings
- `vi.mock('resend', ...)` to stub Resend SDK
- `vi.stubGlobal('fetch', ...)` to stub Google userinfo endpoint
- Test DB: D1 in-memory via better-sqlite3 or Drizzle memory adapter

**Vitest config** (`apps/api/vitest.config.ts`, lines 1–13):

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }, // @/* alias matches tsconfig
  },
  test: { globals: true },
});
```

---

## Shared Patterns

### Hono App Init and `Bindings` Type

**Source:** `apps/api/src/index.ts` (lines 1–20)
**Apply to:** `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/auth.ts`, all service files that need `c.env`

```typescript
// Bindings type must be threaded through Hono generics
const router = new Hono<{ Bindings: Bindings }>();
// Access DB: const db = createDb(c.env.DB);
// Access secrets: c.env.JWT_ACCESS_SECRET (NEVER at module scope)
```

### Drizzle `createDb` Factory

**Source:** `packages/db/src/index.ts` (lines 1–8)
**Apply to:** All service files that query the database

```typescript
import { createDb } from '@app/db';
// In service or route handler:
const db = createDb(c.env.DB);
// Then use db.query.*, db.select(), db.insert(), etc.
```

### Path Aliases

**Source:** `tsconfig.base.json` (lines 16–19) + `apps/api/tsconfig.json` (line 11) + `apps/web/tsconfig.json` (line 11)
**Apply to:** Every new file across both apps

```typescript
// API files: @/* resolves to apps/api/src/*
import { registerSchema } from '@/schemas/auth';
import { createEmailService } from '@/lib/email';
import type { Bindings } from '@/types';

// Any file accessing DB:
import { createDb } from '@app/db';
import { users, refreshTokens, authTokens } from '@app/db/schema';
```

### Error Response Shape

**Source:** CLAUDE.md + `.claude/rules/api-routes.md`
**Apply to:** All route handlers in `apps/api/src/routes/auth.ts`

```typescript
// Expected errors: throw HTTPException — Hono serializes these
import { HTTPException } from 'hono/http-exception';
throw new HTTPException(403, { message: 'email_not_verified' });
// The response shape must be: { error: { code, message, details? } }
// For validation errors (422), @hono/zod-validator formats automatically
```

### TypeScript Named Exports + `import type`

**Source:** `apps/web/src/app/layout.tsx` (line 1), `apps/web/src/lib/utils.ts` (line 1), `.claude/rules/typescript.md`
**Apply to:** All non-page files

```typescript
import type { Metadata } from 'next';        // type-only → import type
import type { ClassValue } from 'clsx';
// Named exports everywhere except Next.js page.tsx and route.ts (framework requires default)
export function cn(...inputs: ClassValue[]) { ... }
export { authRouter };
```

### Tailwind + `cn()` Utility

**Source:** `apps/web/src/lib/utils.ts` (lines 1–6)
**Apply to:** All web component files (`apps/web/src/components/auth/*.tsx`, pages)

```typescript
import { cn } from '@/lib/utils';
// className={cn('base-classes', conditionalClass && 'extra-class')}
```

### `waitUntil` for Background Work

**Source:** RESEARCH.md Pattern 5 + Pitfall anti-pattern
**Apply to:** Any route handler that sends email

```typescript
// Fire-and-forget: does not block response
c.executionCtx.waitUntil(emailService.sendVerificationEmail(user.email, url));
// NOT: await emailService.send(...) — blocks response and risks timeout
```

---

## No Analog Found

All files below have no analog in the current codebase. Planner should use RESEARCH.md patterns directly.

| File                                           | Role          | Data Flow        | Reason                           |
| ---------------------------------------------- | ------------- | ---------------- | -------------------------------- |
| `apps/api/src/services/auth-service.ts`        | service       | CRUD             | No service files exist yet       |
| `apps/api/src/schemas/auth.ts`                 | validation    | transform        | No schema files exist yet        |
| `apps/api/src/lib/jwt.ts`                      | utility       | transform        | No lib files exist yet           |
| `apps/api/src/lib/token.ts`                    | utility       | transform        | No lib files exist yet           |
| `apps/api/src/lib/email.ts`                    | utility       | request-response | No lib files exist yet           |
| `apps/api/src/types/index.ts`                  | types         | —                | No types directory exists yet    |
| `apps/web/src/app/api/auth/[...path]/route.ts` | BFF proxy     | request-response | No BFF proxies exist yet         |
| `apps/web/src/components/auth/*.tsx`           | components    | request-response | No components exist yet          |
| `apps/web/src/server/auth.ts`                  | server helper | request-response | No server directory exists yet   |
| `apps/web/src/middleware.ts`                   | middleware    | request-response | No Next.js middleware exists yet |

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `packages/db/src/`, `apps/api/tests/`
**Files scanned:** 8 source files (complete codebase at time of mapping)
**Pattern extraction date:** 2026-06-05
**Note:** Analogs are thin because this is a greenfield project. The 6 matched files establish all enforced conventions (Hono app shape, Drizzle schema/factory, Vitest test structure, Next.js page/layout, web utility imports). RESEARCH.md verified patterns fill the auth-specific gaps.
