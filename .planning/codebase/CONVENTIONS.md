# Coding Conventions

**Analysis Date:** 2026-06-05

## Naming Patterns

**Files:**

- React components: PascalCase (e.g., `UserProfile.tsx`, `Dashboard.tsx`)
- Utility files: kebab-case (e.g., `format-date.ts`, `cn.ts`)
- Test files: suffix with `.test.ts` or `.spec.ts` (e.g., `index.test.ts`)
- Configuration files: camelCase or kebab-case as per convention (e.g., `vitest.config.ts`, `.prettierrc.json`)

**Functions:**

- camelCase for all functions and methods (e.g., `fetchUserData()`, `createUser()`, `validateEmail()`)
- React hooks: prefix with `use` (e.g., `useAuth`, `useUser`, `useLocalStorage`)
- Async functions: prefer naming that describes the async operation (e.g., `fetchUser`, `submitForm`)

**Variables:**

- camelCase for all variable and parameter names (e.g., `isLoading`, `userData`, `maxRetryCount`)
- `const` by default; use `let` only when reassignment is necessary

**Types:**

- PascalCase for type names and interfaces (e.g., `UserProfileProps`, `ApiResponse`, `Bindings`)
- Props interfaces: suffix with `Props` (e.g., `UserProfileProps` for `UserProfile` component)
- Use `interface` for extensible object shapes; use `type` for unions and type aliases
- Import types with `import type { ... }` when used only in type positions

**Constants:**

- UPPER_SNAKE_CASE for module-level constants (e.g., `MAX_RETRY_COUNT`, `API_TIMEOUT_MS`)

**CSS Classes:**

- kebab-case for Tailwind CSS classes (applied via `className` prop)
- Use utility-first Tailwind; component-specific styles co-locate with the component

**Database:**

- Table names: snake_case (e.g., `users`, `user_profiles`, `created_at`)
- Column names: snake_case (e.g., `created_at`, `updated_at`, `user_id`)

**API Endpoints:**

- kebab-case path segments (e.g., `/api/user-profiles`, `/api/health`)
- Resource-based naming (e.g., `/users`, `/allocations`, `/health`)
- HTTP methods define the operation (`GET`, `POST`, `PUT`, `DELETE`)

**Environment Variables:**

- UPPER_SNAKE_CASE (e.g., `DATABASE_URL`, `API_KEY`, `CLOUDFLARE_ACCOUNT_ID`)

## Code Style

**Formatting:**

- **Tool:** Prettier (`^3.4.0`)
- **Configuration:** `.prettierrc.json` at project root
- **Key settings:**
  - 2-space indentation (`tabWidth: 2`)
  - 100-character line width (`printWidth: 100`)
  - Single quotes (`singleQuote: true`)
  - Trailing commas in ES5-compatible collections (`trailingComma: 'es5'`)
  - Semicolons required (`semi: true`)
  - LF line endings (`endOfLine: 'lf'`)
  - Always use arrow function parentheses (`arrowParens: 'always'`)
- **Usage:** `npm run format` to write files; `npm run format:check` to verify
- All code must pass Prettier before commit (enforced via pre-commit hooks)

**Linting:**

- **Tool:** ESLint (`^9.0.0`) with TypeScript plugin
- **Configuration:** `eslint.config.mjs` at project root
- **Key rules:**
  - No unused variables (`@typescript-eslint/no-unused-vars`), except parameters prefixed with `_`
  - `@typescript-eslint/no-explicit-any` warns on `any` types (prefer `unknown`)
  - `no-console` allows `console.warn` and `console.error` only (production logging via structured logs)
- **Usage:** `npm run lint` to check; ESLint auto-fixes simple issues via editor integration
- All code must pass linting before commit

**TypeScript Mode:**

- Strict mode enabled (`strict: true` in `tsconfig.base.json`); never disable it
- `target: ES2022`, `lib: ["ES2022"]`
- `noEmit: true` in base config (compilation handled per workspace)
- `forceConsistentCasingInFileNames: true` — no inconsistent imports

## Import Organization

**Order:**

1. Node built-ins (e.g., `import fs from 'fs'`, `import path from 'path'`)
2. External packages (e.g., `import { Hono } from 'hono'`, `import { useState } from 'react'`)
3. Internal workspace packages (e.g., `import { db } from '@app/db'`, `import { schema } from '@app/db'`)
4. Relative imports (e.g., `import { UserCard } from './components/UserCard'`, `import { formatDate } from '../lib/format-date'`)

Separate each group with a blank line.

**Example:**

```typescript
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { db } from '@app/db';
import { users } from '@app/db/schema';

import { UserCard } from './components/UserCard';
```

**Path Aliases:**

- `@/*` resolves to `./src/*` within the same workspace (`apps/web`, `apps/api`, `packages/db`)
- `@app/db` resolves to `packages/db/src/index.ts` from anywhere in the workspace
- `@app/db/*` resolves to `packages/db/src/*` from anywhere in the workspace
- Use aliases for all imports beyond one level of relative paths (`../`). Going up more than one level is a code-review blocker.

**Anti-pattern — do NOT use:**

```typescript
import { Button } from '../../../components/ui/button'; // Bad
import { utils } from '../../../../lib/utils'; // Bad
```

**Correct — use aliases:**

```typescript
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

## Error Handling

**API Routes (Hono):**

- Return structured error responses with consistent shape: `{ error: { code, message, details? } }`
- Use appropriate HTTP status codes: `400` for validation, `401` for unauthenticated, `403` for unauthorized, `500` for server errors
- Throw `HTTPException` for expected errors; catch unhandled exceptions and return generic 500 response
- Never return internal error messages, stack traces, or database error details to the client

**Frontend (React/Next.js):**

- Use error boundaries for component-level failures
- Prefer try/catch in async operations; never let promises reject silently
- Use `toast` notifications (via `sonner`) for user-facing errors, not alerts

**General Patterns:**

- Always include context when logging errors: `console.error('fetchUser failed:', { userId, error })`
- Never log secrets, auth tokens, or full request bodies
- Log only request IDs, resource IDs, and operation context
- Use consistent error categories (e.g., `ValidationError`, `NotFoundError`, `AuthError`)

## Logging

**Framework:** `console` (warnings and errors only)

**Patterns:**

- Use `console.warn()` for warnings; `console.error()` for errors
- Do not use `console.log()` for production logging (prefer structured logs)
- Include context object: `console.error('operation failed:', { context, error })`
- Never log PII (personally identifiable information), auth tokens, or credentials
- Log correlation IDs for tracing request chains across services

**Example:**

```typescript
console.error('Database query failed:', { userId, tableName, error });
```

## Comments

**When to Comment:**

- Explain the "why" behind non-obvious logic, not the "what" (code should be self-documenting)
- Comment workarounds, hacks, and temporary solutions with a clear reason
- Do not comment obvious code: `const isValid = true; // set to true`

**JSDoc/TSDoc:**

- Use JSDoc for exported functions and types, especially public APIs
- Include `@param`, `@returns`, `@throws` tags for clarity
- Required for `services/` functions and public utilities
- Optional for simple one-line functions

**Example:**

```typescript
/**
 * Formats a date to ISO 8601 string.
 * @param date - The date to format
 * @returns ISO string representation
 */
export function formatISODate(date: Date): string {
  return date.toISOString();
}
```

**TODO/FIXME:**

- Use `// TODO: <description>` for incomplete features
- Use `// FIXME: <description>` for known bugs or issues
- Include context: `// TODO: add retry logic for failed API calls`
- Do not commit large blocks of commented-out code; use git history instead

## Function Design

**Size:**

- Keep functions small and focused on a single responsibility
- Aim for functions under 20 lines; refactor larger functions
- Each function should do one thing well

**Parameters:**

- Prefer explicit parameters over options objects for < 3 params
- Use object parameters for > 3 related params: `function createUser({ name, email, role })`
- For React components, define `Props` interface: `interface UserCardProps { user: User }`

**Return Values:**

- Prefer explicit return types in function signatures (TypeScript enforces this in strict mode)
- Return early to reduce nesting: `if (!user) return null;`
- Use `Promise<T>` for async functions

**Example:**

```typescript
// Good: explicit types, early return, focused responsibility
export function findUserById(userId: string): User | null {
  if (!userId) return null;
  return db.query.users.findFirst({ where: { id: userId } });
}

// Bad: implicit return, no early return, too much logic
function findUserAndProcessData(userId) {
  if (userId) {
    const user = db.query.users.findFirst({ where: { id: userId } });
    if (user) {
      // lots of processing
      return processedResult;
    }
  }
}
```

## Module Design

**Exports:**

- Use named exports by default; default exports only for Next.js route files (`page.tsx`, `layout.tsx`)
- Group related exports in barrel files (index.ts): `export { Button } from './Button'; export { Input } from './Input';`
- Keep barrel files focused on a single concern (e.g., all UI components from one directory)

**Example:**

```typescript
// src/components/ui/index.ts
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';

// Usage
import { Button, Card } from '@/components/ui';
```

**Single Responsibility:**

- One component per file in `components/` (except shadcn/ui primitives)
- Group related utilities in `lib/` by concern (e.g., `format-date.ts`, `validate-email.ts`)
- Keep services focused: database access in `services/`, HTTP routing in `routes/`

## Async & Promises

**Pattern:**

- Always use `async/await` over `.then()` chains
- Use try/catch for error handling
- Never leave promises unhandled (`void` prefix if intentional)

**Example:**

```typescript
// Good
async function fetchUser(id: string) {
  try {
    const user = await db.query.users.findFirst({ where: { id } });
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', { id, error });
    throw error;
  }
}

// Bad — promise chain, no error handling
function fetchUser(id: string) {
  return db.query.users.findFirst({ where: { id } }).then((user) => user);
}
```

## Validation

**Frontend (Next.js):**

- Use Zod schemas (`^4.3.6`) for client-side form validation
- Validate at form submission, not on every keystroke

**Backend (Hono):**

- Use `@hono/zod-validator` (`^0.7.6`) to validate requests
- Validate every request body, path parameter, and query string at the route entry point
- Return 422 (Unprocessable Entity) for validation errors

**Example:**

```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

app.post('/users', zValidator('json', createUserSchema), async (c) => {
  const { email, name } = c.req.valid('json');
  // ... create user
});
```

## Cloudflare Workers (apps/api)

**Bindings:**

- Access D1 database via `c.env.DB` (typed as `Bindings` type)
- Never hardcode connection strings; always use environment bindings
- Define `Bindings` type at app initialization: `type Bindings = { DB: D1Database };`

**Example:**

```typescript
type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/users', async (c) => {
  const db = createDb(c.env.DB);
  const users = await db.query.users.findMany();
  return c.json(users);
});
```

**Performance:**

- Keep Worker bundle size under 1MB (compressed)
- Use `waitUntil()` for background tasks that should not block the response
- Minimize external API calls; use caching where possible

## No `any` Type

**Rule:** Never use `any` without explicit justification.

**Workaround if unavoidable:**

```typescript
const data = response.data as unknown; // intentional: legacy API returns untyped JSON
```

Always pair `any` with `// intentional: <reason>` on the same line.

**Better alternatives:**

- Use `unknown` and narrow it: `const data = response.data as unknown; if (typeof data === 'object') { ... }`
- Use `Record<string, unknown>` for dynamic objects
- Use Zod to parse untyped data: `const parsed = mySchema.parse(data)`

---

_Convention analysis: 2026-06-05_
