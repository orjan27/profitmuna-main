---
description: Generate and apply database migrations for profitmuna-main
---

# Run Migrations

## Drizzle + D1

1. Review current schema in `packages/db/src/schema.ts`
2. Generate migration: `cd packages/db && npx drizzle-kit generate`
3. Apply locally: `cd apps/api && npx wrangler d1 migrations apply DB --local`
4. Verify migration file is clean and matches schema intent
5. Run tests to verify data layer still works: `npm run test`

## Guidelines

- Migrations must be additive — never modify an existing migration file
- Include both up and down logic where possible
- Test with realistic data volumes if the migration touches existing rows
