# Codebase Structure

**Analysis Date:** 2026-06-05

## Directory Layout

```
profitmuna-main/                      # Monorepo root
├── .claude/                           # Claude tooling (hooks, skills, rules)
├── .planning/                         # Generated planning documents
├── .scaffold/                         # Generator templates
├── apps/                              # Application packages
│   ├── api/                           # Hono API on Cloudflare Workers
│   │   ├── src/
│   │   │   └── index.ts               # Hono app, routes, middleware
│   │   ├── tests/
│   │   │   └── index.test.ts          # API route tests
│   │   ├── wrangler.toml              # Cloudflare Workers config
│   │   ├── vitest.config.ts           # Test runner config
│   │   ├── tsconfig.json              # TypeScript config
│   │   └── package.json               # API dependencies
│   └── web/                           # Next.js frontend
│       ├── src/
│       │   ├── app/                   # Next.js App Router routes
│       │   │   ├── layout.tsx          # Root layout
│       │   │   ├── page.tsx            # Home page (/)
│       │   │   └── globals.css         # Global styles
│       │   ├── components/            # Reusable React components (to be created)
│       │   ├── hooks/                 # React hooks (to be created)
│       │   ├── lib/                   # Utilities
│       │   │   └── utils.ts           # Tailwind class merge helper
│       │   ├── server/                # Server-only modules (to be created)
│       │   ├── types/                 # Shared TypeScript types (to be created)
│       │   └── styles/                # Additional CSS (to be created)
│       ├── next.config.ts             # Next.js configuration
│       ├── tsconfig.json              # TypeScript config
│       └── package.json               # Web dependencies
├── packages/                          # Shared libraries
│   └── db/                            # Database layer
│       ├── src/
│       │   ├── schema.ts              # Drizzle table definitions
│       │   └── index.ts               # DB client factory, exports
│       ├── migrations/                # Drizzle migrations (generated)
│       ├── drizzle.config.ts          # Drizzle Kit config
│       ├── tsconfig.json              # TypeScript config
│       └── package.json               # DB dependencies
├── docs/                              # Project documentation (to be created)
├── CLAUDE.md                          # Project rules & structure (source of truth)
├── STANDARDS.md                       # Coding conventions
├── README.md                          # Project overview
├── AGENTS.md                          # Agent configuration (optional)
├── PLUGINS-TO-INSTALL.md              # IDE plugins
├── tsconfig.base.json                 # Base TypeScript config (inherited by all)
├── turbo.json                         # Turbo monorepo config
├── package.json                       # Root workspace config
├── package-lock.json                  # Dependency lockfile
├── .prettierrc.json                   # Code formatter config
├── eslint.config.mjs                  # ESLint config
├── .mcp.json                          # MCP server config
├── .gitignore                         # Git ignore rules
└── .nvmrc                             # Node.js version spec

```

## Directory Purposes

**`.claude/`:**

- Purpose: Claude tooling configuration (hooks, skills, custom rules)
- Contains: `hooks/` (pre-tool guards), `skills/` (best practice guides), `rules/` (project conventions)
- Key files: `hooks/folder-structure-guard.js` (enforces CLAUDE.md structure), `skills/nextjs-best-practices/`, `skills/hono-best-practices/`

**`apps/api/`:**

- Purpose: Edge API server on Cloudflare Workers
- Contains: Route handlers, middleware, business logic (future services), validation schemas (future)
- Key files: `src/index.ts` (Hono app entry), `wrangler.toml` (Workers config), `tests/` (Vitest suite)
- Generated: Node modules, build artifacts (in `.wrangler/`)
- Committed: Source code, config, tests

**`apps/web/`:**

- Purpose: Next.js server-side rendered frontend
- Contains: Page routes (App Router), components, utilities, hooks, server actions (future)
- Key files: `src/app/layout.tsx` (root), `src/app/page.tsx` (home), `src/lib/utils.ts` (helpers)
- Generated: Node modules, `.next/` build, `.turbo/` cache
- Committed: Source code, config, tests

**`packages/db/`:**

- Purpose: Shared database layer using Drizzle ORM
- Contains: SQLite schema, query helpers, migration files
- Key files: `src/schema.ts` (table definitions), `src/index.ts` (Drizzle factory), `drizzle.config.ts`
- Generated: Node modules, migration SQL files in `migrations/`
- Committed: Schema definitions, migration scripts

**`docs/`:**

- Purpose: Project documentation (PRDs, architecture, guides, runbooks)
- Contents: Markdown files for project documentation
- Note: Create as needed; currently not present

**Root Config:**

- `CLAUDE.md`: Project structure rules and conventions (single source of truth)
- `STANDARDS.md`: Coding conventions (naming, commits, error handling)
- `README.md`: Project overview
- `tsconfig.base.json`: Base TypeScript config inherited by all packages
- `turbo.json`: Monorepo task orchestration (build, test, lint)
- `package.json`: Root workspace dependencies (Turbo, Prettier)

## Key File Locations

**Entry Points:**

- Web frontend: `apps/web/src/app/layout.tsx` (root layout) and `apps/web/src/app/page.tsx` (home)
- API server: `apps/api/src/index.ts` (Hono app initialization)
- Database: `packages/db/src/index.ts` (Drizzle factory and schema exports)

**Configuration:**

- Project structure rules: `CLAUDE.md`
- Coding standards: `STANDARDS.md`
- TypeScript base: `tsconfig.base.json`
- Monorepo orchestration: `turbo.json`
- Code formatting: `.prettierrc.json`
- Linting: `eslint.config.mjs`
- Cloudflare Workers: `apps/api/wrangler.toml`
- Drizzle ORM: `packages/db/drizzle.config.ts`

**Core Logic:**

- API routes and handlers: `apps/api/src/index.ts` (all routes currently in one file)
- Database schema: `packages/db/src/schema.ts` (table definitions)
- Database factory: `packages/db/src/index.ts` (Drizzle client creation)
- Web utilities: `apps/web/src/lib/utils.ts` (Tailwind class merging)

**Testing:**

- API tests: `apps/api/tests/index.test.ts` (Vitest suite)
- Test config: `apps/api/vitest.config.ts`

## Naming Conventions

**Files:**

- Components: `PascalCase.tsx` (e.g., `UserCard.tsx`, `Button.tsx`)
- Utilities: `kebab-case.ts` (e.g., `format-date.ts`, `api-client.ts`)
- Pages/Routes: `kebab-case/` or `page.tsx` (Next.js convention)
- Tests: `[name].test.ts` or `[name].spec.ts` (colocated next to code)
- Config: lowercase with extension (e.g., `next.config.ts`, `vitest.config.ts`)

**Directories:**

- Feature modules: `kebab-case/` (e.g., `user-profile/`, `budget-allocation/`)
- Utility groupings: lowercase (e.g., `lib/`, `types/`, `hooks/`, `components/`)
- Routes: lowercase with optional brackets for dynamic segments (e.g., `app/budget/[id]/`)
- Services: `camelCase.ts` (e.g., `userService.ts`, `budgetService.ts`)

**Functions & Variables:**

- Functions: `camelCase` (e.g., `fetchUser()`, `calculateBudget()`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_ALLOCATION_COUNT`)
- React hooks: `useX` pattern (e.g., `useBudget`, `useUser`)

**Types:**

- Interfaces/Types: `PascalCase` (e.g., `User`, `BudgetAllocation`)
- Props types: `ComponentNameProps` suffix (e.g., `UserCardProps`, `ButtonProps`)
- Database types: Inferred from schema (e.g., `typeof schema.users.$inferSelect`)

## Where to Add New Code

**New Feature (e.g., user registration, budget allocation):**

- API routes: Split `apps/api/src/index.ts` into `apps/api/src/routes/` (e.g., `routes/users.ts`)
- Business logic: `apps/api/src/services/` (e.g., `services/userService.ts`)
- Validation: `apps/api/src/schemas/` (e.g., `schemas/user.ts`)
- Frontend pages: `apps/web/src/app/[feature]/` (e.g., `apps/web/src/app/register/page.tsx`)
- Frontend components: `apps/web/src/components/[feature]/` (e.g., `components/RegisterForm.tsx`)
- Types: `apps/web/src/types/` (e.g., `types/index.ts`)

**New Component/Module:**

- Shared React component: `apps/web/src/components/` (e.g., `components/ui/Card.tsx`)
- React hook: `apps/web/src/hooks/` (e.g., `hooks/useUserData.ts`)
- API utility (non-business logic): `apps/api/src/lib/` (e.g., `lib/error-handler.ts`)
- Middleware: `apps/api/src/middleware/` (e.g., `middleware/auth.ts`)

**Utilities:**

- Web utilities (formatters, helpers): `apps/web/src/lib/` (e.g., `lib/date-formatter.ts`)
- API utilities (no framework deps): `apps/api/src/lib/` (e.g., `lib/validation-helpers.ts`)
- Shared utilities across packages: Not yet applicable (future: consider `packages/shared/lib/`)

**Database Changes:**

- Schema: `packages/db/src/schema.ts` (add new table or modify existing)
- Query helpers: `packages/db/src/queries/` (e.g., `queries/user-queries.ts`) once they exceed 50 lines in `index.ts`
- Migrations: Auto-generated by `drizzle-kit generate` into `packages/db/migrations/`

**Tests:**

- Co-locate with code: `[filename].test.ts` next to the implementation (e.g., `services/userService.ts` → `services/userService.test.ts`)
- API integration tests: `apps/api/tests/` (e.g., `tests/routes.test.ts` for multiple endpoints)

## Special Directories

**`apps/api/src/` — API Server Structure (Currently Flat):**

- Purpose: Hono edge API handlers
- Current state: All routes in `index.ts`
- Future structure (when features grow):
  ```
  src/
  ├── index.ts            # Hono app, middleware, health checks
  ├── routes/             # Resource-based route handlers
  │   ├── users.ts
  │   ├── allocations.ts
  │   └── budgets.ts
  ├── services/           # Business logic
  │   ├── userService.ts
  │   ├── allocationService.ts
  │   └── budgetService.ts
  ├── schemas/            # Zod validation schemas
  │   ├── user.ts
  │   ├── allocation.ts
  │   └── budget.ts
  ├── middleware/         # Custom middleware
  │   ├── auth.ts
  │   └── error-handler.ts
  ├── lib/                # Utilities
  │   └── db-helpers.ts
  └── types/              # Shared types
      └── index.ts
  ```

**`apps/web/src/` — Frontend Structure (Currently Minimal):**

- Current state: Only `app/` (routes) and `lib/` (utils)
- Future structure (when features grow):
  ```
  src/
  ├── app/                # Next.js routes
  │   ├── layout.tsx
  │   ├── page.tsx
  │   ├── register/
  │   ├── dashboard/
  │   └── budget/
  ├── components/         # Reusable React components
  │   ├── ui/            # shadcn/ui components
  │   ├── forms/         # Form components (RegisterForm, etc.)
  │   ├── layout/        # Layout components (Header, Nav, etc.)
  │   └── features/      # Feature-specific components
  ├── hooks/             # React hooks
  │   ├── useAuth.ts
  │   ├── useBudget.ts
  │   └── useForm.ts
  ├── lib/               # Utilities
  │   ├── utils.ts       # Class merging helper
  │   └── api-client.ts  # API request utilities
  ├── server/            # Server-only code
  │   └── actions.ts     # Next.js server actions
  ├── types/             # Shared types
  │   └── index.ts
  ├── styles/            # Additional CSS modules
  │   └── variables.css
  └── app/globals.css
  ```

**`packages/db/` — Database Layer:**

- Purpose: Shared Drizzle ORM schema and client
- Generated: `migrations/` directory (auto-created by drizzle-kit)
- Manual edits: `src/schema.ts` only (never hand-edit migrations)
- Future: `src/queries/` for complex, reusable queries (once they outgrow `index.ts`)

**`docs/` — Project Documentation:**

- Currently not present; should contain:
  - `ARCHITECTURE.md` — System design and data flow
  - `DATABASE.md` — Schema guide, relationships, migrations
  - `API.md` — Endpoint specifications, examples
  - `DEPLOYMENT.md` — Instructions for staging/production
  - `RUNBOOK.md` — Common tasks and troubleshooting

---

_Structure analysis: 2026-06-05_
