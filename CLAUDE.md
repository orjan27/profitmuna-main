# Profitmuna Main

A finance app that automatically applies percentage allocations to your income for proper budgeting

## Scope

### In Scope

A finance app that automatically applies percentage allocations to your income for proper budgeting

### Non-Goals

Do NOT implement features outside the in-scope description above. Specifically:

- direct messaging

Never add adjacent features "for completeness". If the user hasn't asked for it and it isn't in scope, it doesn't belong in this repo.

## Project Structure

- `apps/web/` — Next.js 15.4.11 frontend (App Router, Tailwind CSS, shadcn/ui)
- `apps/api/` — Hono 4.12.9 API on Cloudflare Workers
- `packages/db/` — Drizzle ORM 0.45.2 schema and migrations (Cloudflare D1)

- `docs/` — Project documentation (PRDs, architecture docs, runbooks, guides)

## Project Structure (STRICT)

**STRICTLY follow the project structure below.** Do not create new top-level directories, rename existing ones, or reorganize files. Place new files only in the established locations. If unsure where something goes, check the structure first. If a genuine need for a new folder exists, update this section in `CLAUDE.md` _before_ creating the folder.

A PreToolUse hook at `.claude/hooks/folder-structure-guard.js` enforces this against `.claude/allowed-paths.json`:

- Writes matching `forbiddenGlobs` (e.g. `apps/*/src/utils/**`) are **hard-blocked**. These are known-bad patterns.
- Writes outside `allowedGlobs` **prompt the user** to approve. If you get prompted, either (a) correct the path to one listed in "Project Structure (STRICT)", or (b) if a new folder is genuinely needed, ask the user, then update this section _and_ `.claude/allowed-paths.json` before proceeding.
- Edits to existing files are always allowed.
- **Root `.md` hard-block**: Only `CLAUDE.md`, `README.md`, `AGENTS.md`, `STANDARDS.md`, and `PLUGINS-TO-INSTALL.md` may exist at root. All other Markdown files must go in `docs/`. The exempt list is in `exemptRootMd` in `.claude/allowed-paths.json`.

### `apps/web/src/` (Next.js)

| Folder           | What goes here                                                       | What does NOT                                           |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `app/`           | Routes, layouts, route-scoped server components                      | Reusable UI, business logic                             |
| `components/`    | Shared UI primitives and composite components                        | Route-specific one-offs (keep in `app/`)                |
| `components/ui/` | shadcn/ui generated primitives                                       | Hand-edited code — regenerate via `/generate-component` |
| `lib/`           | Framework-agnostic utilities (e.g. `utils.ts`, formatters)           | React hooks, server-only code                           |
| `hooks/`         | React hooks — files named `useX.ts`                                  | Non-hook utilities                                      |
| `server/`        | Server-only modules: server actions, DB calls via `@app/db`, secrets | Anything imported from client components                |
| `types/`         | Shared TypeScript types/interfaces                                   | Runtime code                                            |
| `styles/`        | Global CSS beyond `app/globals.css`                                  | Component-scoped styles (co-locate)                     |

### `apps/api/src/` (Hono)

| Folder        | What goes here                                         | What does NOT                     |
| ------------- | ------------------------------------------------------ | --------------------------------- |
| `routes/`     | Route handlers grouped by resource (`routes/users.ts`) | Business logic                    |
| `middleware/` | Hono middleware (auth, logging, CORS)                  | Route handlers                    |
| `services/`   | Business logic; DB access via `@app/db`                | HTTP concerns, `c.req` / `c.json` |
| `schemas/`    | Zod schemas for request/response validation            | Runtime helpers                   |
| `lib/`        | Pure utilities — no framework dependency               | Framework-coupled code            |
| `types/`      | Shared TypeScript types                                | Runtime code                      |

### `packages/db/src/`

| File / Folder | What goes here                                      |
| ------------- | --------------------------------------------------- |
| `schema.ts`   | Drizzle schema — single source of truth             |
| `index.ts`    | Public exports: `db` client, query helpers          |
| `queries/`    | Reusable query helpers once they outgrow `index.ts` |

## Forbidden Patterns

| Forbidden                                        | Why                                | Use instead                                                                                             |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| New top-level directory at repo root             | Structure drift; breaks tooling    | Update "Project Structure (STRICT)" in `CLAUDE.md` first, then add                                      |
| `*.md` at project root (non-exempt)              | Root clutter; docs belong together | Move to `docs/`. Only CLAUDE.md, README.md, AGENTS.md, STANDARDS.md, PLUGINS-TO-INSTALL.md stay at root |
| `apps/*/src/utils/`                              | Duplicates `lib/`                  | Put framework-agnostic utilities in `lib/`                                                              |
| `apps/*/src/helpers/`                            | Duplicates `lib/`                  | Put helpers in `lib/`                                                                                   |
| `apps/*/src/common/`                             | Duplicates `lib/` and `types/`     | Split into `lib/` (utilities) and `types/` (shared types)                                               |
| Business logic in `routes/`                      | Routes should be thin              | Move to `services/`                                                                                     |
| HTTP concerns (`c.req`, `c.json`) in `services/` | Services are framework-agnostic    | Keep in `routes/`                                                                                       |

| `import '../../../...'` beyond one `../` | Path churn on refactor | Use `@/*` or `@app/db` aliases |
| Hand edits to `components/ui/*` | shadcn regenerates these | Re-run `/generate-component` |
| New `.claude/` hooks, skills, or rules | Structure drift in tooling | Ask the user first |

## Path Aliases

Use aliases instead of deep relative paths. Going up more than one `../` is a code-review blocker.

| Alias | Resolves to                 | Where                                 |
| ----- | --------------------------- | ------------------------------------- |
| `@/*` | `./src/*` (current package) | `apps/web`, `apps/api`, `packages/db` |

| `@app/db` | `packages/db/src/index.ts` | anywhere in the workspace |
| `@app/db/*` | `packages/db/src/*` | anywhere in the workspace |

Examples:

```ts
// ✅ good
import { Button } from '@/components/ui/button';
import { db } from '@app/db';
import { users } from '@app/db/schema';

// ❌ bad
import { Button } from '../../../components/ui/button';
```

## Conventions

Follow STANDARDS.md at the project root. Key rules:

- **TypeScript strict mode** — no `any` without justification
- **Components**: PascalCase, one per file
- **Functions**: camelCase
- **Files**: kebab-case for utilities, PascalCase for components
- **Imports**: external deps first, then internal packages, then relative
- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)

## Commands

- `/new-feature <name>` — Scaffold a new feature
- `/review` — Review pending changes
- `/deploy-check` — Pre-deployment verification
- `/run-migrations` — Generate and apply database migrations
- `/generate-component <Name>` — Generate a UI component

## Best Practices Skills

Framework principles are captured as skills under `.claude/skills/`. Consult these before writing non-trivial code in the matching stack:

- `/nextjs-best-practices` — Next.js App Router: Server vs Client Components, data fetching, routing patterns

- `/hono-best-practices` — Hono on edge runtimes: routing, middleware, typed bindings, RPC

## MCP Servers

This project uses MCP servers configured in `.mcp.json`.

Verify setup: `npx wrangler whoami` (Cloudflare auth)

## Rules

1. **STRICTLY follow the project structure above.** Do not create new directories, rename existing ones, or reorganize files. Place new files only in the established locations. If unsure where something goes, check the structure first.
2. Do not add features that aren't in `## Scope`. When in doubt, ask.
3. Keep code simple. No unnecessary abstractions, no premature generalization.
4. All dependencies are already pinned in `package.json`. Do not add new ones without user approval.
5. Use path aliases (`@/*`, `@app/db`) instead of deep relative imports.
6. Follow `STANDARDS.md` for naming, commits, and review conventions.
7. Never commit secrets, `.env*` files, or build artifacts.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Profitmuna**

A personal finance app that automatically applies Profit First percentage allocations to your income for proper budgeting. Users record income and expenses, configure allocation percentages across accounts (Profit, Owner Pay, Tax, Operating Expenses, plus custom), and track money across wallets with computed balances. Single-user — each user manages their own finances.

**Core Value:** When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

### Constraints

- **Tech stack**: Next.js 15.4.11 + Hono 4.12.9 on Cloudflare Workers + Drizzle 0.45.2/D1 — already pinned; no new deps without user approval (Resend SDK will need approval/addition)
- **Structure**: STRICT project structure per CLAUDE.md, enforced by PreToolUse hook; routes thin, business logic in `services/`
- **Edge runtime**: API runs on Cloudflare Workers — no Node-only APIs; scheduled emails need Workers cron triggers
- **Fidelity**: Finance behavior must match the reference implementation exactly (minus rentals/tenancy)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9.3 - Used across all applications (web, API, database layer)
- JavaScript - Configuration files (ESLint config, PostCSS config, Turbo config)

## Runtime

- Node.js 22 (specified in `.nvmrc`)
- npm 10.0.0
- Lockfile: `package-lock.json` present

## Frameworks

- Next.js 15.4.11 - Frontend framework with App Router (`apps/web/`)
- Hono 4.12.9 - API framework on Cloudflare Workers (`apps/api/`)
- Drizzle ORM 0.45.2 - Database schema and migrations (`packages/db/`)
- React 19.2.4 - UI library (web)
- React DOM 19.2.4 - React DOM bindings (web)
- Tailwind CSS 4.1.0 - Utility-first CSS framework
- shadcn/ui - UI component library (managed via `apps/web/components.json`)
- Turbo 2.4.0 - Monorepo task orchestrator
- Wrangler 4.78.0 - Cloudflare Workers deployment tool
- Drizzle Kit 0.31.10 - Schema migration generation tool
- Next.js built-in bundler (Turbopack enabled for dev)
- Vitest 3.0.0 - Test runner for API (`apps/api/`)
- Playwright - E2E testing support (configured in `.mcp.json`)

## Key Dependencies

- zod 4.3.6 - TypeScript-first schema validation (used in web, API, and validation layers)
- drizzle-orm 0.45.2 - Type-safe ORM for Cloudflare D1 database
- hono 4.12.9 - Lightweight web framework for edge/Workers runtime
- @hono/zod-validator 0.7.6 - Zod integration for Hono request validation
- jose 6.2.2 - JWT handling (issued by API)
- bcryptjs 3.0.3 - Password hashing for user authentication
- lucide-react 1.8.0 - Icon library
- @tanstack/react-table 8.21.3 - Headless table component library
- cmdk 1.1.1 - Command/search palette component
- sonner 2.0.7 - Toast notification library
- nuqs 2.8.9 - URL search params state management for Next.js
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.5.0 - Tailwind CSS class conflict resolver
- class-variance-authority 0.7.0 - Component variant engine for shadcn/ui
- date-fns 4.1.0 - Date utility library
- @date-fns/tz 1.4.1 - Timezone support for date-fns
- @opennextjs/cloudflare 1.18.0 - Next.js adapter for Cloudflare Workers

## Configuration

- Configured via `.env` file (template at `.env.example`)
- Key variables:
- `tsconfig.base.json` (`/tsconfig.base.json`) - Base TypeScript configuration with path aliases
- `apps/web/tsconfig.json` - Next.js specific TypeScript config with JSX support
- `apps/api/tsconfig.json` - Hono API TypeScript config for Workers runtime
- `packages/db/tsconfig.json` - Database package TypeScript config
- `apps/api/wrangler.toml` - Cloudflare Workers configuration with D1 database binding
- `apps/web/components.json` - shadcn/ui configuration for component generation
- `apps/web/postcss.config.mjs` - PostCSS/Tailwind configuration
- `eslint.config.mjs` - Shared ESLint configuration (flat config format)
- `turbo.json` - Turbo monorepo build orchestration

## Platform Requirements

- Node.js 22+ (from `.nvmrc`)
- npm 10.0.0+
- Cloudflare account for Workers and D1 database
- API tokens and credentials in `.env` (Cloudflare, OpenAI/Anthropic optional)
- Deployment target: Cloudflare Workers (API, `apps/api/`)
- Database: Cloudflare D1 (SQLite-based)
- Frontend hosting: Vercel or Cloudflare Pages (Next.js with `@opennextjs/cloudflare` adapter)
- Compatibility date: 2026-04-22 (set in `wrangler.toml`)

## Database

- `users` - User accounts with id (PK), email (unique), name, createdAt
- Tool: Drizzle Kit
- Location: `packages/db/migrations/`
- Commands:

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase (e.g., `UserProfile.tsx`, `Dashboard.tsx`)
- Utility files: kebab-case (e.g., `format-date.ts`, `cn.ts`)
- Test files: suffix with `.test.ts` or `.spec.ts` (e.g., `index.test.ts`)
- Configuration files: camelCase or kebab-case as per convention (e.g., `vitest.config.ts`, `.prettierrc.json`)
- camelCase for all functions and methods (e.g., `fetchUserData()`, `createUser()`, `validateEmail()`)
- React hooks: prefix with `use` (e.g., `useAuth`, `useUser`, `useLocalStorage`)
- Async functions: prefer naming that describes the async operation (e.g., `fetchUser`, `submitForm`)
- camelCase for all variable and parameter names (e.g., `isLoading`, `userData`, `maxRetryCount`)
- `const` by default; use `let` only when reassignment is necessary
- PascalCase for type names and interfaces (e.g., `UserProfileProps`, `ApiResponse`, `Bindings`)
- Props interfaces: suffix with `Props` (e.g., `UserProfileProps` for `UserProfile` component)
- Use `interface` for extensible object shapes; use `type` for unions and type aliases
- Import types with `import type { ... }` when used only in type positions
- UPPER_SNAKE_CASE for module-level constants (e.g., `MAX_RETRY_COUNT`, `API_TIMEOUT_MS`)
- kebab-case for Tailwind CSS classes (applied via `className` prop)
- Use utility-first Tailwind; component-specific styles co-locate with the component
- Table names: snake_case (e.g., `users`, `user_profiles`, `created_at`)
- Column names: snake_case (e.g., `created_at`, `updated_at`, `user_id`)
- kebab-case path segments (e.g., `/api/user-profiles`, `/api/health`)
- Resource-based naming (e.g., `/users`, `/allocations`, `/health`)
- HTTP methods define the operation (`GET`, `POST`, `PUT`, `DELETE`)
- UPPER_SNAKE_CASE (e.g., `DATABASE_URL`, `API_KEY`, `CLOUDFLARE_ACCOUNT_ID`)

## Code Style

- **Tool:** Prettier (`^3.4.0`)
- **Configuration:** `.prettierrc.json` at project root
- **Key settings:**
- **Usage:** `npm run format` to write files; `npm run format:check` to verify
- All code must pass Prettier before commit (enforced via pre-commit hooks)
- **Tool:** ESLint (`^9.0.0`) with TypeScript plugin
- **Configuration:** `eslint.config.mjs` at project root
- **Key rules:**
- **Usage:** `npm run lint` to check; ESLint auto-fixes simple issues via editor integration
- All code must pass linting before commit
- Strict mode enabled (`strict: true` in `tsconfig.base.json`); never disable it
- `target: ES2022`, `lib: ["ES2022"]`
- `noEmit: true` in base config (compilation handled per workspace)
- `forceConsistentCasingInFileNames: true` — no inconsistent imports

## Import Organization

- `@/*` resolves to `./src/*` within the same workspace (`apps/web`, `apps/api`, `packages/db`)
- `@app/db` resolves to `packages/db/src/index.ts` from anywhere in the workspace
- `@app/db/*` resolves to `packages/db/src/*` from anywhere in the workspace
- Use aliases for all imports beyond one level of relative paths (`../`). Going up more than one level is a code-review blocker.

## Error Handling

- Return structured error responses with consistent shape: `{ error: { code, message, details? } }`
- Use appropriate HTTP status codes: `400` for validation, `401` for unauthenticated, `403` for unauthorized, `500` for server errors
- Throw `HTTPException` for expected errors; catch unhandled exceptions and return generic 500 response
- Never return internal error messages, stack traces, or database error details to the client
- Use error boundaries for component-level failures
- Prefer try/catch in async operations; never let promises reject silently
- Use `toast` notifications (via `sonner`) for user-facing errors, not alerts
- Always include context when logging errors: `console.error('fetchUser failed:', { userId, error })`
- Never log secrets, auth tokens, or full request bodies
- Log only request IDs, resource IDs, and operation context
- Use consistent error categories (e.g., `ValidationError`, `NotFoundError`, `AuthError`)

## Logging

- Use `console.warn()` for warnings; `console.error()` for errors
- Do not use `console.log()` for production logging (prefer structured logs)
- Include context object: `console.error('operation failed:', { context, error })`
- Never log PII (personally identifiable information), auth tokens, or credentials
- Log correlation IDs for tracing request chains across services

## Comments

- Explain the "why" behind non-obvious logic, not the "what" (code should be self-documenting)
- Comment workarounds, hacks, and temporary solutions with a clear reason
- Do not comment obvious code: `const isValid = true; // set to true`
- Use JSDoc for exported functions and types, especially public APIs
- Include `@param`, `@returns`, `@throws` tags for clarity
- Required for `services/` functions and public utilities
- Optional for simple one-line functions
- Use `// TODO: <description>` for incomplete features
- Use `// FIXME: <description>` for known bugs or issues
- Include context: `// TODO: add retry logic for failed API calls`
- Do not commit large blocks of commented-out code; use git history instead

## Function Design

- Keep functions small and focused on a single responsibility
- Aim for functions under 20 lines; refactor larger functions
- Each function should do one thing well
- Prefer explicit parameters over options objects for < 3 params
- Use object parameters for > 3 related params: `function createUser({ name, email, role })`
- For React components, define `Props` interface: `interface UserCardProps { user: User }`
- Prefer explicit return types in function signatures (TypeScript enforces this in strict mode)
- Return early to reduce nesting: `if (!user) return null;`
- Use `Promise<T>` for async functions

## Module Design

- Use named exports by default; default exports only for Next.js route files (`page.tsx`, `layout.tsx`)
- Group related exports in barrel files (index.ts): `export { Button } from './Button'; export { Input } from './Input';`
- Keep barrel files focused on a single concern (e.g., all UI components from one directory)
- One component per file in `components/` (except shadcn/ui primitives)
- Group related utilities in `lib/` by concern (e.g., `format-date.ts`, `validate-email.ts`)
- Keep services focused: database access in `services/`, HTTP routing in `routes/`

## Async & Promises

- Always use `async/await` over `.then()` chains
- Use try/catch for error handling
- Never leave promises unhandled (`void` prefix if intentional)

## Validation

- Use Zod schemas (`^4.3.6`) for client-side form validation
- Validate at form submission, not on every keystroke
- Use `@hono/zod-validator` (`^0.7.6`) to validate requests
- Validate every request body, path parameter, and query string at the route entry point
- Return 422 (Unprocessable Entity) for validation errors

## Cloudflare Workers (apps/api)

- Access D1 database via `c.env.DB` (typed as `Bindings` type)
- Never hardcode connection strings; always use environment bindings
- Define `Bindings` type at app initialization: `type Bindings = { DB: D1Database };`
- Keep Worker bundle size under 1MB (compressed)
- Use `waitUntil()` for background tasks that should not block the response
- Minimize external API calls; use caching where possible

## No `any` Type

- Use `unknown` and narrow it: `const data = response.data as unknown; if (typeof data === 'object') { ... }`
- Use `Record<string, unknown>` for dynamic objects
- Use Zod to parse untyped data: `const parsed = mySchema.parse(data)`

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component    | Responsibility                                                           | File                        |
| ------------ | ------------------------------------------------------------------------ | --------------------------- |
| Web Frontend | Server-side rendering, page routing, UI components, client state         | `apps/web/src/app/`         |
| Web Utils    | Shared utilities (class merging, formatters)                             | `apps/web/src/lib/`         |
| API Server   | HTTP routing, request validation, CORS, business logic, auth, DB queries | `apps/api/src/index.ts`     |
| DB Schema    | Table definitions, type exports, Drizzle config                          | `packages/db/src/schema.ts` |
| DB Client    | Query builder factory, Drizzle instance creation                         | `packages/db/src/index.ts`  |

## Pattern Overview

- **Monorepo**: Turbo workspace management (`pnpm`) with three independent applications sharing a database package
- **API-driven**: Frontend talks exclusively to the Hono API; direct DB access only in `apps/api`
- **Edge-first**: API runs on Cloudflare Workers (not a traditional Node.js server)
- **Type-safe**: Full TypeScript across all layers with strict mode enabled
- **Database-centric**: All data mutations happen through the API layer via Drizzle ORM queries

## Layers

- Purpose: Server-side rendered React UI, routing, dynamic page generation
- Location: `apps/web/`
- Contains: Page routes (`app/`), components, utilities, server actions (future)
- Depends on: React 19, Next.js 15, Tailwind CSS, UI component libraries
- Used by: End users (browsers)
- Entry point: `apps/web/src/app/layout.tsx` (root layout) → `apps/web/src/app/page.tsx` (home page)
- Purpose: HTTP request handling, request validation, business logic, database access orchestration
- Location: `apps/api/src/`
- Contains: Route handlers, middleware, services (when added), validation schemas
- Depends on: Hono framework, Zod validation, Cloudflare Workers runtime, D1 database binding
- Used by: Next.js frontend, external clients (if public endpoints exist)
- Entry point: `apps/api/src/index.ts` (Hono app initialization with routes and middleware)
- Runtime: Cloudflare Workers edge network (configured in `wrangler.toml`)
- Purpose: Database schema definition, query abstraction, type safety
- Location: `packages/db/src/`
- Contains: Schema tables (`schema.ts`), Drizzle factory (`index.ts`), future query helpers (`queries/`)
- Depends on: Drizzle ORM, SQLite dialect
- Used by: API layer via `@app/db` import
- Configuration: `drizzle.config.ts` specifies SQLite dialect and schema location

## Data Flow

### Primary Request Path (User Action → Page Load)

### Typical API Call Flow (Future - when features are added)

- Frontend: React component state (via `useState` hooks, no global state yet)
- Backend: Stateless HTTP handlers; all state in D1 database
- Session: Not yet implemented (future JWT auth via `jose` package visible in dependencies)

## Key Abstractions

- Purpose: Isolates Drizzle client initialization from route handlers
- Location: `packages/db/src/index.ts`
- Pattern: Factory function accepting `D1Database` binding, returns typed Drizzle instance
- Usage: `const db = createDb(c.env.DB)` in API route handlers (when needed)
- Purpose: Type-safe table and column references across API
- Location: `packages/db/src/schema.ts`
- Pattern: Named exports for each table (e.g., `export const users = sqliteTable(...)`)
- Usage: `import { users } from '@app/db/schema'` in queries
- Purpose: Request/response validation at route boundary
- Location: `apps/api/src/schemas/` (to be created)
- Pattern: Separate schema file per resource (e.g., `users.ts`, `allocations.ts`)
- Usage: `zod()` middleware from `@hono/zod-validator` package

## Entry Points

- Location: `apps/web/src/app/layout.tsx`
- Triggers: Browser request to `/` or any route under `apps/web/src/app/`
- Responsibilities: Apply root layout, set metadata, render child pages
- Location: `apps/web/src/app/page.tsx`
- Triggers: Browser request to `/`
- Responsibilities: Render home page UI (currently a placeholder)
- Location: `apps/api/src/index.ts`
- Triggers: HTTP request to any `/` or `/api/*` endpoint
- Responsibilities: Initialize Hono app, attach middleware (CORS), register routes, export default app for Cloudflare Workers
- Location: `packages/db/src/index.ts`
- Triggers: API layer calls `createDb(d1Binding)` when handling a request
- Responsibilities: Instantiate Drizzle client with schema, export schema definitions

## Architectural Constraints

- **Threading:** Single-threaded event loop (Node.js/Cloudflare Workers model). No explicit background workers yet; future tasks can use `waitUntil()`.
- **Global state:** No global variables in API routes. Bindings (`c.env.DB`) are request-scoped via Hono context.
- **Circular imports:** None detected. DB package exports only types and factory; API consumes via `@app/db` alias.
- **Database connections:** Stateless; each request creates a new Drizzle instance via `createDb()`. No connection pooling (D1 handles internally).
- **API response format:** All endpoints return `{ ... }` JSON. Error format not yet standardized (future: structured error responses).

## Anti-Patterns

### Fetching from Frontend Directly to Database

- Keep DB imports only in `apps/api/src/`
- Fetch from Next.js to Hono via `fetch('http://localhost:8793/api/...')` (dev) or `fetch('https://api.example.com/api/...')` (prod)
- Let the API layer handle validation and persistence

### Monolithic Route Handlers

- Create `apps/api/src/routes/` directory with resource-based files (e.g., `users.ts`, `allocations.ts`)
- Move business logic to `apps/api/src/services/` (e.g., `userService.ts`)
- Routes stay thin: validate → call service → return response
- Services handle DB queries and domain logic

## Error Handling

- Validation errors: `422 Unprocessable Entity` with details (future: via Zod middleware)
- Auth errors: `401 Unauthorized` (future: when auth is added)
- Permission errors: `403 Forbidden` (future: when authorization is added)
- Not found: `404 Not Found`
- Server errors: `500 Internal Server Error` with a generic message (full error logged server-side)
- Success: `200 OK` with JSON payload

## Cross-Cutting Concerns

- Frontend: React form validation (future: client-side Zod)
- API: Zod schemas in route handlers or middleware (future: `apps/api/src/schemas/`)

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill                 | Description                                                                                                                                      | Path                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| hono-best-practices   | "Build ultra-fast web APIs and full-stack apps with Hono — runs on Cloudflare Workers, Deno, Bun, Node.js, and any WinterCG-compatible runtime." | `.claude/skills/hono-best-practices/SKILL.md`   |
| nextjs-best-practices | Next.js App Router principles. Server Components, data fetching, routing patterns.                                                               | `.claude/skills/nextjs-best-practices/SKILL.md` |

<!-- GSD:skills-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
