# Technology Stack

**Analysis Date:** 2026-06-05

## Languages

**Primary:**

- TypeScript 5.9.3 - Used across all applications (web, API, database layer)

**Secondary:**

- JavaScript - Configuration files (ESLint config, PostCSS config, Turbo config)

## Runtime

**Environment:**

- Node.js 22 (specified in `.nvmrc`)

**Package Manager:**

- npm 10.0.0
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**

- Next.js 15.4.11 - Frontend framework with App Router (`apps/web/`)
- Hono 4.12.9 - API framework on Cloudflare Workers (`apps/api/`)
- Drizzle ORM 0.45.2 - Database schema and migrations (`packages/db/`)

**UI & Styling:**

- React 19.2.4 - UI library (web)
- React DOM 19.2.4 - React DOM bindings (web)
- Tailwind CSS 4.1.0 - Utility-first CSS framework
- shadcn/ui - UI component library (managed via `apps/web/components.json`)

**Build/Dev:**

- Turbo 2.4.0 - Monorepo task orchestrator
- Wrangler 4.78.0 - Cloudflare Workers deployment tool
- Drizzle Kit 0.31.10 - Schema migration generation tool
- Next.js built-in bundler (Turbopack enabled for dev)

**Testing:**

- Vitest 3.0.0 - Test runner for API (`apps/api/`)
- Playwright - E2E testing support (configured in `.mcp.json`)

## Key Dependencies

**Critical:**

- zod 4.3.6 - TypeScript-first schema validation (used in web, API, and validation layers)
- drizzle-orm 0.45.2 - Type-safe ORM for Cloudflare D1 database
- hono 4.12.9 - Lightweight web framework for edge/Workers runtime
- @hono/zod-validator 0.7.6 - Zod integration for Hono request validation

**Authentication & Security:**

- jose 6.2.2 - JWT handling (issued by API)
- bcryptjs 3.0.3 - Password hashing for user authentication

**UI & Component Libraries:**

- lucide-react 1.8.0 - Icon library
- @tanstack/react-table 8.21.3 - Headless table component library
- cmdk 1.1.1 - Command/search palette component
- sonner 2.0.7 - Toast notification library
- nuqs 2.8.9 - URL search params state management for Next.js

**Utilities:**

- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.5.0 - Tailwind CSS class conflict resolver
- class-variance-authority 0.7.0 - Component variant engine for shadcn/ui
- date-fns 4.1.0 - Date utility library
- @date-fns/tz 1.4.1 - Timezone support for date-fns

**Cloudflare Workers Runtime:**

- @opennextjs/cloudflare 1.18.0 - Next.js adapter for Cloudflare Workers

## Configuration

**Environment:**

- Configured via `.env` file (template at `.env.example`)
- Key variables:
  - `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account identifier
  - `CLOUDFLARE_API_TOKEN` - API token for Workers and D1 deployment
  - `D1_DATABASE_ID` - Database identifier for Cloudflare D1
  - `NODE_ENV` - Standard Node environment (`development` or `production`)
  - `NEXT_PUBLIC_API_URL` - Public API URL for web client (e.g., `http://localhost:8793`)
  - `ANTHROPIC_API_KEY` - Anthropic API key (optional, for future AI features)
  - `OPENAI_API_KEY` - OpenAI API key (optional, for future AI features)

**Build:**

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

**Development:**

- Node.js 22+ (from `.nvmrc`)
- npm 10.0.0+
- Cloudflare account for Workers and D1 database
- API tokens and credentials in `.env` (Cloudflare, OpenAI/Anthropic optional)

**Production:**

- Deployment target: Cloudflare Workers (API, `apps/api/`)
- Database: Cloudflare D1 (SQLite-based)
- Frontend hosting: Vercel or Cloudflare Pages (Next.js with `@opennextjs/cloudflare` adapter)
- Compatibility date: 2026-04-22 (set in `wrangler.toml`)

## Database

**Type:** SQLite (via Cloudflare D1)

**Schema Location:** `packages/db/src/schema.ts`

**Current Tables:**

- `users` - User accounts with id (PK), email (unique), name, createdAt

**ORM:** Drizzle ORM with D1 adapter

**Migrations:**

- Tool: Drizzle Kit
- Location: `packages/db/migrations/`
- Commands:
  - `npm run generate` - Generate new migration files
  - `npm run migrate` - Apply pending migrations to D1
  - `npm run studio` - View/manage data via Drizzle Studio

---

_Stack analysis: 2026-06-05_
