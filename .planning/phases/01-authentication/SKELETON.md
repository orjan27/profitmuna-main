# Walking Skeleton — Profitmuna

**Phase:** 1
**Generated:** 2026-06-05

## Capability Proven End-to-End

A visitor can register in the browser, the account is written to Cloudflare D1, a verification email
is dispatched via Resend, clicking the verification link flips `email_verified` to true, and an
unverified login attempt is hard-blocked (403 `email_not_verified`). This exercises the full stack:
Next.js UI -> Next.js BFF proxy -> Hono Workers API -> Drizzle/D1 (real read + write) -> Resend.

## Architectural Decisions

| Decision            | Choice                                                                                                 | Rationale                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework (web)     | Next.js 15.4.11 App Router                                                                             | Pinned scaffold; Server Components + route-handler BFF                                                                                              |
| Framework (API)     | Hono 4.12.9 on Cloudflare Workers                                                                      | Pinned; edge runtime; thin routes + services split                                                                                                  |
| Data layer          | Cloudflare D1 (SQLite) + Drizzle ORM 0.45.2                                                            | Pinned; single schema source `packages/db/src/schema.ts`, access via `@app/db` only                                                                 |
| Web ↔ API transport | BFF proxy in Next.js (`app/api/auth/[...path]/route.ts`)                                               | D-01: browser is same-origin to Next.js only; API never called directly from browser; BFF relays Set-Cookie                                         |
| Session model       | jose HS256 JWT access (30m httpOnly) + DB-stored rotating opaque refresh (7d httpOnly)                 | ROADMAP-locked 30/7-day; rotation + reuse-detection (D-11)                                                                                          |
| Password hashing    | Web Crypto PBKDF2-SHA256, 210k iters, 16-byte salt                                                     | Zero new deps, Workers-native fast, no bcryptjs CPU-timeout risk; documented deviation from bcrypt-cost-12 literal (security.md permits equivalent) |
| Link tokens         | sha256-hashed, single-use, expiring rows in `auth_tokens`                                              | D-09/D-10                                                                                                                                           |
| Email               | Resend SDK via `executionCtx.waitUntil()`                                                              | D-04; fire-and-forget, non-blocking                                                                                                                 |
| Google OAuth        | arctic 3.7.0 (PKCE, state)                                                                             | D-05; edge-friendly                                                                                                                                 |
| Cookies             | httpOnly, SameSite=Lax, Secure in prod, set by API, relayed by BFF                                     | D-02                                                                                                                                                |
| Deployment target   | Local full-stack dev run (wrangler dev + next dev); D1 `--local` migrations                            | Cloudflare deploy deferred to deploy-time (needs real database_id + secrets)                                                                        |
| Directory layout    | STRICT per CLAUDE.md — API `routes/services/schemas/middleware/lib/types`; web `app/components/server` | Enforced by PreToolUse hook                                                                                                                         |

## Stack Touched in Phase 1 (Slice 01 = skeleton)

- [x] Project scaffold — new deps (resend, arctic), env vars, types, lib primitives, Vitest harness
- [x] Routing — real auth routes mounted (`app.route('/api/auth', authRouter)`) + BFF catch-all
- [x] Database — real read AND write: register inserts a `users` row; verify-email reads/updates it; schema pushed to D1 (migration applied)
- [x] UI — interactive register form wired through the BFF to the API
- [x] Deployment — documented local full-stack run command (`npm run dev` in apps/api + apps/web); D1 migration applied `--local`

## Local full-stack run

```
# terminal 1 — API on Workers (D1 local)
cd apps/api && npm run dev          # wrangler dev --port 8793

# terminal 2 — web (BFF + UI)
cd apps/web && npm run dev          # next dev --port 3006

# one-time: apply schema to local D1
cd packages/db && npx drizzle-kit generate
cd apps/api && npx wrangler d1 migrations apply profitmuna-main-db --local
```

Set `API_BASE_URL=http://localhost:8793` (server-only) for the web BFF; JWT/Resend/Google secrets via
`.env` / `wrangler secret put`.

## Out of Scope (Deferred to Later Slices / Phases)

- Login, JWT session issuance, transparent refresh, logout → slice 02 (this phase)
- Password reset flow → slice 03 (this phase)
- Google OAuth sign-in + account linking → slice 04 (this phase)
- All finance features (income, expenses, allocation, wallets) → Phases 2–5
- Settings, notifications, scheduled reminder emails → Phase 6
- Hardened (atomic) rate limiting via Durable Objects / Cloudflare WAF — v1 uses a non-atomic D1 counter
- Production Cloudflare deployment (real D1 database_id, domain-verified Resend sender)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 1 slice 02:** email/password login + JWT cookie sessions + transparent BFF refresh + logout
- **Phase 1 slice 03:** password reset via emailed single-use link
- **Phase 1 slice 04:** Google OAuth sign-in + account linking
- **Phase 2:** record/browse/edit income & expenses with categories
- **Phase 3:** Profit First allocation accounts + derived balances
- **Phase 4:** wallets + category mappings + computed balances
- **Phase 5:** dashboard summary
- **Phase 6:** settings + notifications + scheduled reminder emails
