---
description: Scaffold a new feature in profitmuna-main
argument-hint: feature name (e.g. "user-profile")
---

# New Feature: $ARGUMENTS

## Phase 1: Plan

1. Create a brief plan for the feature including:
   - Which files need to be created or modified
   - Database schema changes (if any)
   - API endpoints (if any)
   - UI components (if any)
2. Confirm the plan with the user before proceeding

## Phase 2: Implement

### Database (if needed)

1. Add schema changes to `packages/db/src/schema.ts`
2. Generate migration: `cd packages/db && npx drizzle-kit generate`

### API

1. Create route handler in `apps/api/src/routes/`
2. Add route to `apps/api/src/index.ts`
3. Add request/response validation with Zod

### Frontend

1. Consult `/nextjs-best-practices` for Server vs Client Component boundaries, data fetching, and routing patterns before coding.
2. Create page or component in `apps/web/src/`.
3. Follow existing component patterns and naming conventions.
4. Use shadcn/ui primitives where applicable.

## Phase 3: Test

1. Write unit tests for new logic
2. Write API tests for new endpoints
3. Run `npm run typecheck` to verify types
4. Run `npm run test` to verify all tests pass

## Success Criteria

- [ ] Feature works as described
- [ ] Types pass strict mode
- [ ] Tests cover happy path and key error cases
- [ ] No lint errors
