# Coding Standards — Profitmuna Main

Generated on 2026-06-05T13:08:29.033Z.

## Naming Conventions

| Element               | Convention                  | Example              |
| --------------------- | --------------------------- | -------------------- |
| React components      | PascalCase                  | `UserProfile.tsx`    |
| Component props       | PascalCase + `Props` suffix | `UserProfileProps`   |
| Functions             | camelCase                   | `fetchUserData()`    |
| Utility files         | kebab-case                  | `format-date.ts`     |
| Constants             | UPPER_SNAKE_CASE            | `MAX_RETRY_COUNT`    |
| CSS classes           | kebab-case                  | `user-profile-card`  |
| Database tables       | snake_case                  | `user_profiles`      |
| API endpoints         | kebab-case                  | `/api/user-profiles` |
| Environment variables | UPPER_SNAKE_CASE            | `DATABASE_URL`       |

## Import Order

Organize imports in this order, separated by blank lines:

1. **Node built-ins** — `fs`, `path`, `crypto`
2. **External packages** — `react`, `next`, `hono`, `drizzle-orm`
3. **Internal packages** — `@profitmuna-main/db`, `@profitmuna-main/shared`
4. **Relative imports** — `./components/`, `../utils/`

```typescript
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { db } from '@profitmuna-main/db';

import { UserCard } from './components/UserCard';
```

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Scope**: `web`, `api`, `db`, `config`

**Examples**:

- `feat(api): add user registration endpoint`
- `fix(web): resolve hydration mismatch on profile page`
- `chore(config): update TypeScript to 5.9.3`

## Branch Strategy

| Branch         | Purpose                                                    |
| -------------- | ---------------------------------------------------------- |
| `main`         | Production-ready code. Protected.                          |
| `develop`      | Integration branch for features.                           |
| `feat/<name>`  | New features. Branch from `develop`.                       |
| `fix/<name>`   | Bug fixes. Branch from `develop` (or `main` for hotfixes). |
| `chore/<name>` | Maintenance tasks. Branch from `develop`.                  |

## PR Checklist

Before requesting review, verify:

- [ ] Branch is up to date with `develop`
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run test` passes with zero failures
- [ ] `npm run lint` shows no errors
- [ ] No `.env` files or secrets in the diff
- [ ] Commit messages follow conventional commits
- [ ] New endpoints have request validation
- [ ] Changed components have corresponding tests
- [ ] README or docs updated if behavior changes

## TypeScript

- **Strict mode** is enabled. Do not disable it.
- Prefer `interface` over `type` for object shapes.
- Use `unknown` instead of `any`. If `any` is unavoidable, add a `// eslint-disable-next-line` with justification.
- Use branded types for IDs: `type UserId = string & { __brand: 'UserId' }`

## Error Handling

- API routes: return structured error responses with appropriate HTTP status codes
- Frontend: use error boundaries for component-level failures
- Async operations: always use try/catch, never let promises reject silently
- Log errors with context: `console.error('fetchUser failed:', { userId, error })`

## Cloudflare Workers

- Access bindings via `c.env.BINDING_NAME` — never hardcode connection strings
- Use `wrangler dev` for local development with local D1
- Keep worker bundle size under 1MB (compressed)
- Use `waitUntil()` for background tasks that should not block the response

## Formatting

- **Prettier** handles code formatting — do not manually format
- **ESLint** handles code quality — fix all errors before committing
- Both run automatically via editor integration and pre-commit hooks
