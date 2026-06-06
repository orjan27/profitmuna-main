---
phase: 02-income-expenses
plan: 01
subsystem: database, api, web
tags: [drizzle, sqlite, d1, hono, nextjs, nuqs, zod, migration]

# Dependency graph
requires:
  - phase: 01-auth
    provides: requireAuth middleware, users table, getSession(), auth patterns
provides:
  - incomeCategories, incomes, expenseCategories, expenses DB tables + migration
  - apiFetch server-only client + ApiError for server actions and RSC
  - formatCurrency(cents) / toCents(pesos) currency helpers
  - formatDate(iso) date helper
  - PAYMENT_METHODS constants + PaymentMethodValue type
  - NuqsAdapter in layout.tsx (enables useQueryState across income/expense pages)
  - createTestDb() with Phase 2 schema (enables unit tests in Plans 02/03)
  - 4 stub routers mounted behind requireAuth (unblocks parallel Plan 02/03 work)
  - paginationSchema, paginationWithDateSchema, idParamSchema common Zod schemas
affects:
  - 02-income-expenses (plans 02, 03 build on these routes and tables)
  - 03-profit-first-allocation (incomes table + moneyStatus feed allocation logic)
  - 04-wallets (expenses table feeds wallet balance computations)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Per-request createDb(c.env.DB) factory in route handlers'
    - 'Server-only apiFetch with Bearer token from access_token cookie'
    - 'Integer cents for all money amounts (D-08)'
    - 'Soft delete via deletedAt nullable text column'
    - 'Unique index on (userId, name) for race-safe idempotent seeding'
    - 'Stub routers + requireAuth mount pattern for parallel plan execution'

key-files:
  created:
    - packages/db/src/index.ts
    - packages/db/drizzle.config.ts
    - packages/db/package.json
    - packages/db/migrations/0001_serious_sebastian_shaw.sql
    - apps/api/src/routes/incomes.ts
    - apps/api/src/routes/income-categories.ts
    - apps/api/src/routes/expenses.ts
    - apps/api/src/routes/expense-categories.ts
    - apps/api/src/schemas/common.ts
    - apps/web/src/server/api.ts
    - apps/web/src/lib/format-currency.ts
    - apps/web/src/lib/format-date.ts
    - apps/web/src/lib/constants.ts
    - apps/web/src/lib/utils.ts
    - apps/web/tsconfig.json
    - tsconfig.base.json
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/index.ts
    - apps/web/src/app/layout.tsx
    - apps/api/tests/helpers/db.ts

key-decisions:
  - 'Stub routers contain no handlers — Plans 02/03 fill them in; avoids merge collisions on shared files'
  - 'tests/helpers/db.ts DDL updated inline (not via migration runner) to keep test setup fast and self-contained'
  - 'tsconfig.base.json and packages/db/src/index.ts were untracked in main repo — created in worktree so typecheck passes'
  - 'layout.tsx: NuqsAdapter wraps children only (Toaster stays outside) to keep query-state scope tight'

patterns-established:
  - 'Schema pattern: integer boolean mode, text enum, $onUpdate for updatedAt, index() as third table arg'
  - 'Route stub pattern: Hono<{Bindings; Variables}>, no handlers, named export, mounted behind requireAuth'
  - 'Currency pattern: toCents() on input, formatCurrency() on output, never store floats'

requirements-completed:
  [INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, EXP-01, EXP-02, EXP-03, EXP-04, EXP-05]

# Metrics
duration: 6min
completed: 2026-06-06
---

# Phase 2 Plan 01: Foundation Slice Summary

**4 income/expense Drizzle tables with migration, 4 requireAuth-guarded stub routers, server-only apiFetch client, currency/date/constants helpers, NuqsAdapter, and in-memory D1 test helper — the shared chokepoints for parallel Plans 02/03**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-06T02:38:52Z
- **Completed:** 2026-06-06T02:45:26Z
- **Tasks:** 3
- **Files modified:** 16 created + 4 modified = 20

## Accomplishments

- Four DB tables (incomeCategories, incomes, expenseCategories, expenses) with correct indexes, boolean modes, text enums, and soft-delete column — migration generated and applied to local D1
- CORS expanded to PUT/DELETE/PATCH; 4 route groups mounted behind requireAuth in index.ts; common Zod schemas created
- Complete web plumbing: server-only apiFetch, formatCurrency/toCents, formatDate, PAYMENT_METHODS, NuqsAdapter in layout, test DB helper updated with Phase 2 schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 4 schema tables and generate + apply the migration** - `721c05f` (feat)
2. **Task 2: Expand CORS, create 4 stub routers, mount them behind requireAuth** - `a1c7559` (feat)
3. **Task 3: Web data-access plumbing + lib helpers + NuqsAdapter + test db helper** - `1ceb30b` (feat)

## Files Created/Modified

- `packages/db/src/schema.ts` - Added incomeCategories, incomes, expenseCategories, expenses tables
- `packages/db/src/index.ts` - createDb factory (was untracked, created in worktree)
- `packages/db/drizzle.config.ts` - Drizzle Kit config (was untracked, created in worktree)
- `packages/db/migrations/0001_serious_sebastian_shaw.sql` - New migration with all 4 CREATE TABLE + indexes
- `apps/api/src/index.ts` - CORS expanded + 4 route groups mounted behind requireAuth
- `apps/api/src/routes/incomes.ts` - Stub router (no handlers yet)
- `apps/api/src/routes/income-categories.ts` - Stub router (no handlers yet)
- `apps/api/src/routes/expenses.ts` - Stub router (no handlers yet)
- `apps/api/src/routes/expense-categories.ts` - Stub router (no handlers yet)
- `apps/api/src/schemas/common.ts` - paginationSchema, paginationWithDateSchema, idParamSchema
- `apps/web/src/server/api.ts` - server-only apiFetch + ApiError
- `apps/web/src/lib/format-currency.ts` - formatCurrency(cents) + toCents(pesos)
- `apps/web/src/lib/format-date.ts` - formatDate(iso) via date-fns
- `apps/web/src/lib/constants.ts` - PAYMENT_METHODS (5 values) + PaymentMethodValue
- `apps/web/src/lib/utils.ts` - cn() helper (was untracked)
- `apps/web/src/app/layout.tsx` - Added NuqsAdapter wrapping children
- `apps/api/tests/helpers/db.ts` - Updated DDL with Phase 2 tables for in-memory tests
- `tsconfig.base.json` - Base TypeScript config (was untracked, needed for api/web)
- `apps/web/tsconfig.json` - Next.js TypeScript config (was untracked)

## Decisions Made

- Stub routers contain no handlers: Plans 02 and 03 fill them in independently without touching index.ts, avoiding merge collisions on shared files.
- `tests/helpers/db.ts` DDL is updated inline rather than running actual migration files, keeping test setup fast and avoiding filesystem dependencies.
- `tsconfig.base.json`, `packages/db/src/index.ts`, `packages/db/drizzle.config.ts`, `apps/web/tsconfig.json` were all untracked in the main repo — created in the worktree so typechecks pass cleanly.
- `NuqsAdapter` wraps only `children` (not `Toaster`) to keep URL-state scope tight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing untracked infrastructure files in worktree**

- **Found during:** Task 2 (typecheck failed: `tsconfig.base.json` not found)
- **Issue:** Worktree only contains tracked git files. `tsconfig.base.json`, `packages/db/src/index.ts`, `packages/db/drizzle.config.ts`, `packages/db/package.json`, and `apps/web/tsconfig.json` all existed in the main repo as untracked files and were not checked in — so the worktree lacked them.
- **Fix:** Created each missing file in the worktree, copying content from the main repo.
- **Files modified:** `tsconfig.base.json`, `packages/db/src/index.ts`, `packages/db/drizzle.config.ts`, `packages/db/package.json`, `apps/web/tsconfig.json`
- **Verification:** `cd apps/api && npm run typecheck` exits 0; `cd apps/web && npm run typecheck` exits 0
- **Committed in:** `a1c7559` (Task 2), `1ceb30b` (Task 3)

**2. [Rule 2 - Missing Critical] Added apps/web/src/lib/utils.ts**

- **Found during:** Task 3 (lib/ directory didn't exist; utils.ts also untracked in main repo)
- **Issue:** The `apps/web/src/lib/` directory needed to exist to create lib files; `utils.ts` is a foundational shared utility referenced throughout the codebase.
- **Fix:** Created `utils.ts` (cn() helper using clsx + tailwind-merge) alongside the other lib files.
- **Files modified:** `apps/web/src/lib/utils.ts`
- **Verification:** TypeCheck passes; file is consistent with main repo content.
- **Committed in:** `1ceb30b` (Task 3)

---

**Total deviations:** 2 auto-fixed (1 blocking infrastructure, 1 missing critical utility)
**Impact on plan:** All auto-fixes were necessary for the worktree to typecheck and build. No scope creep — files were exact copies of existing untracked content in the main repo.

## Issues Encountered

None - all verifications passed on first attempt after the blocking infrastructure files were created.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation slice complete: schema tables applied to local D1, stub routers mounted, API client and lib helpers ready
- Plans 02 and 03 can now proceed in parallel: income routes (Plan 02) and expense routes (Plan 03) build on this foundation without touching shared files
- All 68 existing auth tests still pass; no regressions introduced

---

_Phase: 02-income-expenses_
_Completed: 2026-06-06_

## Self-Check: PASSED

- `packages/db/src/schema.ts` - FOUND, contains all 4 table exports
- `packages/db/migrations/0001_serious_sebastian_shaw.sql` - FOUND, contains CREATE TABLE for all 4 tables
- `apps/api/src/index.ts` - allowMethods expanded, 4 routes mounted
- `apps/api/src/routes/incomes.ts` - FOUND
- `apps/api/src/routes/income-categories.ts` - FOUND
- `apps/api/src/routes/expenses.ts` - FOUND
- `apps/api/src/routes/expense-categories.ts` - FOUND
- `apps/api/src/schemas/common.ts` - FOUND
- `apps/web/src/server/api.ts` - FOUND, starts with import 'server-only'
- `apps/web/src/lib/format-currency.ts` - FOUND, exports formatCurrency + toCents
- `apps/web/src/lib/format-date.ts` - FOUND
- `apps/web/src/lib/constants.ts` - FOUND, PAYMENT_METHODS 5 values
- `apps/web/src/app/layout.tsx` - NuqsAdapter present
- `apps/api/tests/helpers/db.ts` - FOUND, Phase 2 DDL present
- Commits: `721c05f`, `a1c7559`, `1ceb30b` - all present in git log
- API typecheck: PASS
- Web typecheck: PASS
- 68 API tests: PASS
