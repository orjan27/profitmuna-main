<!-- refreshed: 2026-06-05 -->

# Architecture

**Analysis Date:** 2026-06-05

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (Browser)                   │
│         Next.js 15 App Router (React 19 + SSR)              │
│  `apps/web/src/app/` (routes) + `apps/web/src/components/` │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (Next.js server)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             API Layer (Edge Runtime)                          │
│      Hono 4.12.9 on Cloudflare Workers                       │
│              `apps/api/src/index.ts`                         │
│  (Routes, Middleware, Business Logic, DB Access)            │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL (D1 Driver)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             Data Layer (Cloudflare D1)                        │
│         Drizzle ORM 0.45.2 + SQLite                          │
│   `packages/db/src/schema.ts` + `packages/db/src/index.ts`   │
│            (Schema Definition, Query Client)                 │
└─────────────────────────────────────────────────────────────┘
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

**Overall:** Monorepo-based separation of concerns with a three-tier architecture — frontend, API edge layer, and database.

**Key Characteristics:**

- **Monorepo**: Turbo workspace management (`pnpm`) with three independent applications sharing a database package
- **API-driven**: Frontend talks exclusively to the Hono API; direct DB access only in `apps/api`
- **Edge-first**: API runs on Cloudflare Workers (not a traditional Node.js server)
- **Type-safe**: Full TypeScript across all layers with strict mode enabled
- **Database-centric**: All data mutations happen through the API layer via Drizzle ORM queries

## Layers

**Client Layer (Next.js):**

- Purpose: Server-side rendered React UI, routing, dynamic page generation
- Location: `apps/web/`
- Contains: Page routes (`app/`), components, utilities, server actions (future)
- Depends on: React 19, Next.js 15, Tailwind CSS, UI component libraries
- Used by: End users (browsers)
- Entry point: `apps/web/src/app/layout.tsx` (root layout) → `apps/web/src/app/page.tsx` (home page)

**API Layer (Hono on Cloudflare Workers):**

- Purpose: HTTP request handling, request validation, business logic, database access orchestration
- Location: `apps/api/src/`
- Contains: Route handlers, middleware, services (when added), validation schemas
- Depends on: Hono framework, Zod validation, Cloudflare Workers runtime, D1 database binding
- Used by: Next.js frontend, external clients (if public endpoints exist)
- Entry point: `apps/api/src/index.ts` (Hono app initialization with routes and middleware)
- Runtime: Cloudflare Workers edge network (configured in `wrangler.toml`)

**Data Layer (Drizzle ORM + Cloudflare D1):**

- Purpose: Database schema definition, query abstraction, type safety
- Location: `packages/db/src/`
- Contains: Schema tables (`schema.ts`), Drizzle factory (`index.ts`), future query helpers (`queries/`)
- Depends on: Drizzle ORM, SQLite dialect
- Used by: API layer via `@app/db` import
- Configuration: `drizzle.config.ts` specifies SQLite dialect and schema location

## Data Flow

### Primary Request Path (User Action → Page Load)

1. User navigates to `/` in browser
2. Next.js renders `apps/web/src/app/page.tsx` (server component)
3. Layout applies global styles from `apps/web/src/app/globals.css`
4. HTML sent to browser and hydrated with React

### Typical API Call Flow (Future - when features are added)

1. Client component calls server action or fetch to `https://api.example.com/api/resource`
2. Hono router in `apps/api/src/index.ts` matches route
3. CORS middleware at `apps/api/src/index.ts:12` validates origin
4. Route handler validates request body/params with Zod schema (future: `apps/api/src/schemas/`)
5. Handler calls business logic service (future: `apps/api/src/services/`)
6. Service executes Drizzle query via `createDb(c.env.DB)` from `@app/db`
7. Query returns typed result from `packages/db/src/schema.ts`
8. Handler formats response with `c.json()` and returns to client
9. Client receives JSON response

**State Management:**

- Frontend: React component state (via `useState` hooks, no global state yet)
- Backend: Stateless HTTP handlers; all state in D1 database
- Session: Not yet implemented (future JWT auth via `jose` package visible in dependencies)

## Key Abstractions

**Database Factory (`createDb`):**

- Purpose: Isolates Drizzle client initialization from route handlers
- Location: `packages/db/src/index.ts`
- Pattern: Factory function accepting `D1Database` binding, returns typed Drizzle instance
- Usage: `const db = createDb(c.env.DB)` in API route handlers (when needed)

**Schema Exports:**

- Purpose: Type-safe table and column references across API
- Location: `packages/db/src/schema.ts`
- Pattern: Named exports for each table (e.g., `export const users = sqliteTable(...)`)
- Usage: `import { users } from '@app/db/schema'` in queries

**Zod Validation (Future):**

- Purpose: Request/response validation at route boundary
- Location: `apps/api/src/schemas/` (to be created)
- Pattern: Separate schema file per resource (e.g., `users.ts`, `allocations.ts`)
- Usage: `zod()` middleware from `@hono/zod-validator` package

## Entry Points

**Web Frontend Entry:**

- Location: `apps/web/src/app/layout.tsx`
- Triggers: Browser request to `/` or any route under `apps/web/src/app/`
- Responsibilities: Apply root layout, set metadata, render child pages

**Web Home Page:**

- Location: `apps/web/src/app/page.tsx`
- Triggers: Browser request to `/`
- Responsibilities: Render home page UI (currently a placeholder)

**API Entry:**

- Location: `apps/api/src/index.ts`
- Triggers: HTTP request to any `/` or `/api/*` endpoint
- Responsibilities: Initialize Hono app, attach middleware (CORS), register routes, export default app for Cloudflare Workers

**Database Entry:**

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

**What happens:** A Next.js route handler in `apps/web/src/app/` imports from `@app/db` and queries directly.

**Why it's wrong:** Breaks the API boundary. Frontend should only communicate via the Hono API; direct DB access violates separation of concerns and makes auth/validation harder.

**Do this instead:**

- Keep DB imports only in `apps/api/src/`
- Fetch from Next.js to Hono via `fetch('http://localhost:8793/api/...')` (dev) or `fetch('https://api.example.com/api/...')` (prod)
- Let the API layer handle validation and persistence

### Monolithic Route Handlers

**What happens:** All business logic (validation, queries, transformations) lives inside `apps/api/src/index.ts`.

**Why it's wrong:** As the app grows, `index.ts` becomes unmaintainable. Hard to test, hard to reuse logic, hard to add new endpoints.

**Do this instead:**

- Create `apps/api/src/routes/` directory with resource-based files (e.g., `users.ts`, `allocations.ts`)
- Move business logic to `apps/api/src/services/` (e.g., `userService.ts`)
- Routes stay thin: validate → call service → return response
- Services handle DB queries and domain logic

## Error Handling

**Strategy:** Structured responses with HTTP status codes.

**Patterns:**

- Validation errors: `422 Unprocessable Entity` with details (future: via Zod middleware)
- Auth errors: `401 Unauthorized` (future: when auth is added)
- Permission errors: `403 Forbidden` (future: when authorization is added)
- Not found: `404 Not Found`
- Server errors: `500 Internal Server Error` with a generic message (full error logged server-side)
- Success: `200 OK` with JSON payload

## Cross-Cutting Concerns

**Logging:** Not yet centralized. Currently uses browser `console` on frontend and Cloudflare Workers logs on API. Future: structured logging with context (correlation IDs, user IDs).

**Validation:**

- Frontend: React form validation (future: client-side Zod)
- API: Zod schemas in route handlers or middleware (future: `apps/api/src/schemas/`)

**Authentication:** Not yet implemented. `jose` package is pinned but unused. Future JWT-based auth with token validation in API middleware.

**CORS:** Enabled globally on API via `cors()` middleware. Future: restrict to specific origins (`Access-Control-Allow-Origin`).

---

_Architecture analysis: 2026-06-05_
