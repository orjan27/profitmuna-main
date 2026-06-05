# Codebase Concerns

**Analysis Date:** 2026-06-05

## Critical Gaps — Active Development Phase

This is a new project (v0.1.0) with minimal implementation. The following are **not bugs** but **critical missing pieces** for a production-ready finance app:

### User Authentication & Authorization
- **What's missing:** No user auth system exists. API has no route guards.
- **Files affected:** `apps/api/src/index.ts` (entire app is open), `apps/web/src/app/page.tsx` (no auth UI)
- **Impact:** Any user can call any endpoint. Cannot track who owns what data. **Blocks feature development.**
- **Fix approach:** 
  1. Add Cloudflare JWT middleware to `apps/api/src/middleware/` (see `.claude/rules/security.md`)
  2. Implement auth service: `apps/api/src/services/auth.ts`
  3. Add user table + auth endpoints to API
  4. Add login/signup UI to web app

### Database Schema — Incomplete
- **What's missing:** Only a `users` table exists. No financial data tables (allocations, income, transactions).
- **Files:** `packages/db/src/schema.ts`
- **Impact:** Cannot store or track any core finance data. Feature work requires schema updates first.
- **Fix approach:** 
  1. Design full schema (allocations, income entries, categories, rules)
  2. Add tables to `packages/db/src/schema.ts`
  3. Generate migrations with `npm run generate` in `packages/db/`
  4. Add Drizzle query helpers to `packages/db/src/queries/` as needed

### No Database Migrations
- **What's missing:** `packages/db/migrations/` is empty (only `.gitkeep`). No migration files generated.
- **Impact:** Cannot apply schema to production D1. Local dev uses in-memory SQLite.
- **Risk:** Schema drift between local and cloud; rollback not possible.
- **Fix approach:** Once schema is finalized, run `npm run generate` to create migration files and commit them.

### Validation & Error Handling — Minimal
- **What's missing:** API has no input validation. Routes return raw JSON without error structure.
- **Files:** `apps/api/src/index.ts`
- **Details:**
  - Zod is imported (`zod` in `package.json`) but unused
  - `@hono/zod-validator` is available but not used
  - No global error handler
  - Health check and hello endpoint have no validation (not critical for these specific routes, but pattern not established)
- **Impact:** Invalid requests will fail unpredictably. Clients can't distinguish error types. **Blocks production deployment.**
- **Fix approach:**
  1. Create schema file: `apps/api/src/schemas/index.ts`
  2. Define Zod schemas for each endpoint request/response
  3. Use `zod-validator` middleware from `@hono/zod-validator`
  4. Add global error handler in `apps/api/src/index.ts`
  5. See `.claude/rules/api-routes.md` for error response structure

### CORS Configuration — Overly Permissive
- **File:** `apps/api/src/index.ts` (line 12)
- **Issue:** `app.use('/*', cors())` with no options → defaults to allowing all origins with all credentials.
- **Risk:** Anyone can make authenticated requests to your API from their origin. **Security risk.**
- **Fix approach:** Restrict origins in wrangler.toml / environment config:
  ```typescript
  app.use('/*', cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3006',
    credentials: true,
  }));
  ```

### Secrets & Environment Configuration
- **Issue:** No wrangler.toml exists. No environment variable structure defined.
- **Files:** Missing `wrangler.toml`
- **Impact:** Cannot deploy to Cloudflare Workers. Cannot configure D1 binding. Cannot manage secrets.
- **Fix approach:**
  1. Create `wrangler.toml` with D1 database binding and env vars
  2. List all required vars in `.claude/rules/` or docs
  3. Update `.github/workflows/` (if exists) to inject secrets during deploy

### API Binding to D1 — Unused
- **File:** `apps/api/src/index.ts` (lines 5-7)
- **Issue:** Type defined for `DB: D1Database` but never instantiated or used.
- **Impact:** Currently the API doesn't connect to any database. Health check and hello endpoint work, but real work requires DB calls.
- **Fix approach:** Once routes need database access, call `createDb()` from `packages/db/src/index.ts` in middleware or per-route context.

---

## Test Coverage Gaps

### Web App — No Tests
- **Issue:** `apps/web/` has zero test files.
- **Files affected:** All of `apps/web/src/`
- **Risk:** Component changes will silently break. High fragility for UI refactors.
- **Priority:** Medium (non-blocking for v0.1, should be addressed before user-facing features)
- **Fix approach:**
  1. Add Vitest to web package
  2. Co-locate `.test.tsx` files next to components
  3. Start with critical flows: auth, budget calculation, allocation UI

### API — Minimal Tests
- **File:** `apps/api/tests/index.test.ts`
- **Coverage:** Only health check and hello endpoint tested. No database, auth, or validation tests.
- **Risk:** Real endpoints (once written) won't have test coverage.
- **Priority:** High (necessary before merging features)
- **Fix approach:**
  1. Expand test suite to cover all routes
  2. Mock D1 database for integration tests
  3. Test validation errors, auth failures, edge cases

### Database — No Tests
- **Issue:** `packages/db/` has no test files.
- **Risk:** Schema changes won't be validated. Migration bugs won't be caught.
- **Priority:** Medium
- **Fix approach:** Create `packages/db/__tests__/` with tests for query helpers once they're written.

---

## Architecture & Patterns — Underdeveloped

### No Service Layer (API)
- **File:** `apps/api/src/index.ts`
- **Issue:** All logic would live in route handlers if endpoints were written. No `services/` folder structure exists.
- **Pattern violation:** See `.claude/rules/api-routes.md` — routes should be thin.
- **Fix approach:** Create `apps/api/src/services/` and move business logic there as features grow. Routes should only validate + call service + respond.

### No Hooks or Reusable Client Logic (Web)
- **Issue:** `apps/web/src/hooks/` and `apps/web/src/server/` directories don't exist yet.
- **Impact:** As components grow, will likely duplicate fetch logic or server action logic.
- **Fix approach:** 
  1. Create `apps/web/src/hooks/` for `useFetch`, `useAuth`, etc.
  2. Create `apps/web/src/server/` for server actions and DB calls
  3. See `.claude/skills/nextjs-best-practices/` for patterns

---

## Code Quality & Conventions

### Missing Prettier Configuration
- **Issue:** No `.prettierrc` or `.prettierrc.json` in root
- **Details:** STANDARDS.md mentions Prettier but no config file exists
- **Impact:** Developers will use inconsistent line lengths, quote styles, etc.
- **Priority:** Low (but should be set up before more contributors join)
- **Fix approach:** Create `.prettierrc` with project standards (line length 100, trailing commas, etc.)

### ESLint Configuration — Incomplete
- **File:** `eslint.config.mjs`
- **Issue:** 
  - TypeScript strict rules are warn-only (`@typescript-eslint/no-explicit-any`: warn)
  - `.claude/rules/typescript.md` says "Do not use `any`" but ESLint allows it
  - No import ordering rules (should enforce STANDARDS.md ordering)
- **Fix approach:** 
  1. Change `no-explicit-any` to `error`
  2. Add `eslint-plugin-import` and enforce section ordering

### No TypeScript Configuration — Missing `@app/db` in Web App
- **File:** `apps/web/tsconfig.json`
- **Issue:** Web app doesn't have `@app/db` path alias in its tsconfig, but may need it for server actions
- **Fix approach:** Add to `apps/web/tsconfig.json`:
  ```json
  "@app/db": ["../../packages/db/src/index.ts"],
  "@app/db/*": ["../../packages/db/src/*"]
  ```

---

## Dependency Management

### Unused Dependencies
- **Package:** `@opennextjs/cloudflare` (in `apps/web/package.json`)
- **Issue:** Added to package.json but not imported or used anywhere
- **Impact:** Adds bundle size unnecessarily
- **Priority:** Low
- **Fix:** Remove if not needed for Cloudflare deployment; otherwise document why it's there

### Minor Version Drift
- **Details:** Using `@typescript-eslint/eslint-plugin`: `^8.0.0` and parser `^8.0.0` with slight version differences in dependencies
- **Impact:** Minimal risk, but could cause subtle linting inconsistencies across machines
- **Priority:** Very low

---

## Documentation & Clarity

### No API Documentation
- **Issue:** No OpenAPI/Swagger spec or endpoint documentation
- **Files:** `docs/` directory doesn't exist
- **Impact:** Unclear what endpoints exist or what they should do. Blocks onboarding.
- **Priority:** Medium
- **Fix approach:** 
  1. Create `docs/` folder
  2. Add `docs/API.md` with endpoint list and request/response shapes
  3. Consider adding Swagger/OpenAPI spec once API is more mature

### Project Status Unclear
- **File:** `README.md`
- **Issue:** Very minimal. Doesn't explain what "percentage allocations" means or how the app will work.
- **Impact:** Contributors don't understand scope or architecture vision
- **Fix approach:** Expand README with use case, data model sketch, and link to PRD (if it exists)

### No Architecture Documentation
- **Issue:** No `docs/ARCHITECTURE.md` explaining how web, API, and DB layers interact
- **Impact:** Newcomers won't understand data flow
- **Priority:** Medium
- **Fix approach:** Write architecture doc once core schema is finalized

---

## Deployment Readiness

### No Build or CI Pipeline
- **Issue:** No GitHub Actions, no deployment scripts, no smoke tests before deploy
- **Impact:** Cannot safely deploy to production. Manual deployments are error-prone.
- **Priority:** High (needed before first production release)
- **Fix approach:**
  1. Create `.github/workflows/deploy.yml`
  2. Run tests, type checking, lint on every PR
  3. Deploy to Cloudflare Workers + Next.js when main branch updated

### No Environment Variable Documentation
- **Issue:** No `.env.example` or documented list of required secrets
- **Impact:** Deploys fail silently if vars are missing
- **Fix approach:** Create `.env.example` with all required vars (no values, just names)

### Bundle Size Unknown
- **Issue:** No build size reporting or limits set
- **Impact:** API could exceed Cloudflare Worker limits (1MB compressed). Web could be slow.
- **Priority:** Medium (monitor during development, address before launch)
- **Fix approach:** Add build script output that reports bundle sizes

---

## Security Gaps

### Passwords & Sensitive Data
- **Issue:** `bcryptjs` is in API `package.json` but not used (no auth yet)
- **Detail:** `jose` (JWT) also unused
- **When relevant:** Once user auth is added, ensure:
  1. Passwords hashed with cost >= 12 (see `.claude/rules/security.md`)
  2. JWTs are short-lived (15 min max) with refresh rotation
  3. Never log passwords or full tokens

### SQL Injection Prevention
- **Current status:** Not at risk (Drizzle ORM prevents this)
- **Requirement:** When adding queries, always use Drizzle query builder; never concatenate SQL strings

### CSRF Protection
- **Issue:** Not implemented yet
- **Requirement:** Once mutations are added, ensure CSRF token validation (see `.claude/rules/security.md`)

---

## Known Limitations

### SQLite on Cloudflare D1
- **Issue:** Drizzle is configured for SQLite (`dialect: 'sqlite'`) but Cloudflare D1 may have quirks
- **Impact:** Some advanced SQL features may not work
- **Mitigation:** Test migrations on real D1 before production

### Single Page App (No SSR on API)
- **Detail:** Web app is Next.js (supports SSR). API is edge workers (stateless). Good separation, but means sensitive ops (auth checks, DB access) must happen on server side.
- **Requirement:** Never expose D1 credentials to browser; all DB calls must go through API.

---

## Summary — Priority Order

| Priority | Issue | Owner | Est. Effort |
|----------|-------|-------|-------------|
| **CRITICAL** | User authentication system | API team | 3-5 days |
| **CRITICAL** | Database schema for finance data | DB team | 2-3 days |
| **CRITICAL** | Input validation + error handling | API team | 1-2 days |
| **CRITICAL** | Database migrations + deployment config | DevOps | 1 day |
| **HIGH** | API + Web test coverage | QA / Dev | 3-5 days |
| **HIGH** | CORS hardening | Security | 0.5 day |
| **MEDIUM** | API documentation | Docs | 1 day |
| **MEDIUM** | Service layer structure | Architecture | Ongoing |
| **MEDIUM** | Prettier + ESLint rules tightening | QA | 0.5 day |
| **LOW** | Remove unused dependencies | Maintenance | 0.25 day |
| **LOW** | Expand README + architecture docs | Docs | 1 day |

---

*Concerns audit: 2026-06-05*
