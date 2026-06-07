# External Integrations

**Analysis Date:** 2026-06-05

## APIs & External Services

**Cloudflare Services:**

- Cloudflare Workers - API hosting (`apps/api/`)
  - SDK/Client: `wrangler` (CLI for deployment)
  - Auth: `CLOUDFLARE_API_TOKEN` (env var)
  - Binding: `D1` database instance
  - API: Deployed to `https://<worker-subdomain>.workers.dev` or custom domain

- Cloudflare D1 - SQLite database
  - Connection: Configured in `apps/api/wrangler.toml` via `[[d1_databases]]` binding
  - Database ID: `D1_DATABASE_ID` env var
  - Client: Drizzle ORM (`packages/db/src/index.ts`)
  - Schema: `packages/db/src/schema.ts`

**Documentation & Development:**

- context7 MCP Server - Library documentation lookup (configured in `.mcp.json`)
- Playwright MCP Server - E2E testing and browser automation (configured in `.mcp.json`)

## Data Storage

**Databases:**

- Cloudflare D1 (SQLite)
  - Connection: Via Hono Bindings in `apps/api/wrangler.toml`
  - Client: Drizzle ORM
  - Dialect: SQLite (configured in `packages/db/drizzle.config.ts`)
  - Tables:
    - `users` - User account data

**File Storage:**

- Not configured; local filesystem only for development

**Caching:**

- None configured

## Authentication & Identity

**Auth Provider:**

- Custom JWT-based authentication (tokens issued by API)
  - Implementation: `jose` 6.2.2 for JWT signing/verification
  - Password hashing: `bcryptjs` 3.0.3 with cost >= 12
  - Location: Implemented in `apps/api/src/` (routes and middleware)

**Current Status:**

- Infrastructure present (jose, bcryptjs dependencies installed)
- Implementation pending (no authentication routes in `apps/api/src/index.ts` yet)

## Monitoring & Observability

**Error Tracking:**

- None configured

**Logs:**

- Not explicitly configured; framework defaults only
- Hono middleware can be extended with logging

## CI/CD & Deployment

**Hosting:**

- Frontend: Cloudflare Pages or Vercel (Next.js with `@opennextjs/cloudflare` adapter)
- API: Cloudflare Workers
- Database: Cloudflare D1

**CI Pipeline:**

- None configured; manual deployment via `wrangler` CLI
- Recommended: Integrate GitHub Actions for automated testing and deployment

**Deployment Commands:**

- API: `cd apps/api && wrangler deploy` (via `npm run build`)
- Frontend: `cd apps/web && next build` (framework-specific)

## Environment Configuration

**Required env vars:**

_Cloudflare Setup:_

- `CLOUDFLARE_ACCOUNT_ID` - Account identifier for API calls
- `CLOUDFLARE_API_TOKEN` - API token (scope: Workers Scripts, D1, R2)
- `D1_DATABASE_ID` - Production D1 database identifier

_Application:_

- `NODE_ENV` - `development` or `production`
- `NEXT_PUBLIC_API_URL` - Frontend's API endpoint
  - Local dev: `http://localhost:8793`
  - Production: Worker URL or custom domain

_Optional (Future Use):_

- `ANTHROPIC_API_KEY` - For Anthropic Claude API (if integrated)
- `OPENAI_API_KEY` - For OpenAI API (if integrated)

**Secrets location:**

- `.env` file at repo root (must be manually created from `.env.example`)
- Secrets are NOT committed to git
- Cloudflare secrets: Managed via `wrangler secret put` CLI (for production deployments)

## Webhooks & Callbacks

**Incoming:**

- `/health` - Health check endpoint (`apps/api/src/index.ts`)
- `/api/hello` - Example test endpoint
- CORS enabled via `hono/cors` middleware on all routes

**Outgoing:**

- None configured

## Database Setup

**D1 Initialization:**

1. Run `cd apps/api && npx wrangler login` to authenticate
2. Run `npx wrangler d1 create profitmuna-main-db` to create database
3. Update `D1_DATABASE_ID` in `.env` and `apps/api/wrangler.toml`
4. Run migrations: `cd packages/db && npm run generate && npm run migrate`

**Local Development:**

- Uses better-sqlite3 for local schema generation (`packages/db/package.json`)
- Drizzle Studio: `cd packages/db && npm run studio`

## API Authentication Flow

**Not yet implemented.** When adding authentication:

1. **Registration** - POST `/api/auth/register` - Email, password, name → hashed password + JWT
2. **Login** - POST `/api/auth/login` - Email, password → JWT (access token + refresh token)
3. **Token Validation** - Middleware validates JWT `iss`, `aud`, `exp` on protected routes
4. **Token Refresh** - POST `/api/auth/refresh` - Refresh token → new access token
5. **Logout** - POST `/api/auth/logout` - Invalidate refresh token (optional token blacklist)

**Recommended pattern:**

- Short-lived JWTs (15 minutes)
- Secure HTTP-only cookies for refresh tokens
- Validate tokens in Hono middleware before route handlers
- See `.claude/rules/security.md` for implementation requirements

---

_Integration audit: 2026-06-05_
