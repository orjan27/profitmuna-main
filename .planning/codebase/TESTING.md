# Testing Patterns

**Analysis Date:** 2026-06-05

## Test Framework

**Runner:**
- Vitest (`^3.0.0`) for all testing across workspace
- Config: `apps/api/vitest.config.ts` (global setup)
- Other workspaces inherit Vitest configuration

**Assertion Library:**
- Vitest built-in assertions via `expect()` (no additional library needed)
- API: `expect(value).toBe()`, `expect(value).toEqual()`, `expect(value).toHaveProperty()`, etc.

**Run Commands:**
```bash
npm test                  # Run all tests across workspace
npm test -- --watch      # Watch mode
npm test -- --coverage   # Coverage report
turbo test               # Run tests in all workspaces
```

**Individual workspace:**
```bash
cd apps/api
npm test                 # Run API tests only
```

## Test File Organization

**Location:**
- Co-located with source code: test files live in `tests/` directory at the workspace root
- For `apps/api`: tests in `apps/api/tests/`
- Pattern: mirror source directory structure in tests (e.g., `tests/routes/users.test.ts` for `src/routes/users.ts`)

**Naming:**
- Suffix with `.test.ts` for any test file (e.g., `index.test.ts`, `users.test.ts`, `auth.test.ts`)
- File name mirrors the module being tested (e.g., `format-date.test.ts` tests `lib/format-date.ts`)

**Structure:**
```
apps/api/
├── src/
│   ├── routes/
│   │   └── users.ts
│   ├── services/
│   │   └── user-service.ts
│   └── index.ts
└── tests/
    ├── routes/
    │   └── users.test.ts
    ├── services/
    │   └── user-service.test.ts
    └── index.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('API routes', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /api/hello returns greeting', async () => {
    const res = await app.request('/api/hello');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });
});
```

**Key Patterns:**
- Top-level `describe()` wraps the module/feature being tested
- Each `it()` or `test()` covers one assertion concept
- Arrange-Act-Assert structure: setup data, call function, assert result
- Use descriptive test names that read like documentation: "GET /health returns ok"

**Setup and Teardown:**
- `beforeEach()`: run before each test (e.g., seed test data, create test fixtures)
- `afterEach()`: run after each test (e.g., clean up database, reset mocks)
- `beforeAll()`: run once before all tests in suite (e.g., start test server)
- `afterAll()`: run once after all tests in suite (e.g., stop test server, close connections)

**Example:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@app/db';

describe('User service', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up
    await db.delete(users).where({ id: testUserId });
  });

  it('fetches user by ID', async () => {
    const user = await db.query.users.findFirst({ where: { id: testUserId } });
    expect(user?.email).toBe('test@example.com');
  });
});
```

## Mocking

**Framework:** Vitest built-in `vi` module (same as Jest)

**Patterns:**
```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock an entire module
vi.mock('../lib/external-api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ id: 1 })),
}));

// Mock a function
const mockFetch = vi.fn();
vi.mocked(fetchFunction).mockResolvedValue({ data: 'test' });

// Reset mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});
```

**Example:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUser } from '../services/user-service';

// Mock the database
vi.mock('../db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('User service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user when found', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });

    const user = await fetchUser('1');
    expect(user?.email).toBe('test@example.com');
  });

  it('returns null when user not found', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(null);

    const user = await fetchUser('999');
    expect(user).toBeNull();
  });
});
```

**What to Mock:**
- Third-party API calls (payment processors, external SaaS, AI APIs)
- External service integrations
- Time-dependent code (use `vi.useFakeTimers()`)

**What NOT to Mock:**
- Real database calls in integration tests
- HTTP routes/endpoints (call the app directly via `app.request()`)
- Internal functions called by the function being tested
- Built-in modules like `fs`, `crypto` (unless testing error paths)

## Fixtures and Factories

**Test Data:**
Create explicit test data inside each test or in shared fixtures. Do not rely on leftover state from other tests.

**Example — inline fixture:**
```typescript
it('creates user with valid email', async () => {
  const userData = {
    email: 'test@example.com',
    name: 'Test User',
  };

  const user = await createUser(userData);
  expect(user.email).toBe(userData.email);
});
```

**Example — factory function:**
```typescript
function createTestUser(overrides = {}) {
  return {
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  };
}

it('creates user with custom name', async () => {
  const userData = createTestUser({ name: 'Jane Doe' });
  const user = await createUser(userData);
  expect(user.name).toBe('Jane Doe');
});
```

**Location:**
- Factories live in `tests/fixtures/` or co-located with test file as `fixtures.ts`
- Share factories across related tests; avoid duplication

## Coverage

**Requirements:** No enforced coverage target (inherited from Vitest defaults)

**View Coverage:**
```bash
npm test -- --coverage
```

**Coverage output:** Generated in `coverage/` directory (ignored by git)

**Best Practice:** Aim for > 80% coverage of business logic and services; don't obsess over 100% coverage of utility functions.

## Test Types

**Unit Tests:**
- Scope: Single function or service method
- Approach: Isolate the unit, mock dependencies, test inputs/outputs
- Location: `tests/lib/`, `tests/services/`
- Example: testing a formatting utility, validation function, or service method

**Integration Tests:**
- Scope: Multiple components working together (e.g., API route calling a service calling the database)
- Approach: Use real test database (D1), real HTTP boundaries; only mock external third-party services
- Location: `tests/routes/` (for API endpoints), `tests/integration/`
- Example: testing a complete API endpoint, database query + service combo

**E2E Tests:**
- Framework: Not currently set up (Playwright recommended for future addition)
- Scope: User workflows end-to-end
- Would test: login → create allocation → view dashboard (requires running app + browser)

## Common Patterns

**Async Testing:**
```typescript
// Good: use async/await
it('fetches user data', async () => {
  const user = await fetchUser('1');
  expect(user).toBeDefined();
});

// Alternative: return promise (older style, avoid)
it('fetches user data', () => {
  return fetchUser('1').then((user) => {
    expect(user).toBeDefined();
  });
});
```

**Error Testing:**
```typescript
import { describe, it, expect } from 'vitest';

it('throws validation error for invalid email', async () => {
  await expect(async () => {
    await createUser({ email: 'invalid', name: 'Test' });
  }).rejects.toThrow('Invalid email');
});

// Alternative: catch and assert
it('returns error response for invalid request', async () => {
  const res = await app.request('/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid' }),
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe('VALIDATION_ERROR');
});
```

**Testing with Hono:**
```typescript
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('User routes', () => {
  it('creates user via POST /users', async () => {
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', name: 'Test' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  it('returns 400 for missing email', async () => {
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });

    expect(res.status).toBe(400);
  });
});
```

## Best Practices

**One Assertion Concept Per Test:**
```typescript
// Good: focused test
it('returns user with correct email', async () => {
  const user = await fetchUser('1');
  expect(user.email).toBe('test@example.com');
});

// Bad: multiple unrelated assertions
it('returns user', async () => {
  const user = await fetchUser('1');
  expect(user.email).toBe('test@example.com');
  expect(user.name).toBe('Test User');
  expect(user.createdAt).toBeDefined();
  // If email assertion fails, we don't test name and createdAt
});
```

**Deterministic Tests:**
- No real network calls (except to test database)
- No dependence on current time (use `vi.useFakeTimers()` or inject clock)
- No hardcoded delays or `setTimeout`
- Same test input always produces same output

**Descriptive Test Names:**
```typescript
// Good: reads like documentation
it('returns 401 when user provides invalid credentials', async () => {
  // ...
});

// Bad: unclear what's being tested
it('test login', async () => {
  // ...
});
```

**Do Not Use Snapshots:**
```typescript
// Bad: snapshots drift with timestamps, IDs, sorting
expect(apiResponse).toMatchSnapshot();

// Good: assert on specific fields
expect(apiResponse).toHaveProperty('id');
expect(apiResponse.status).toBe('ok');
```

**Explicit Fixtures:**
```typescript
// Bad: relies on shared state from other tests
it('gets user', async () => {
  const user = await getUser(globalTestUserId); // where did globalTestUserId come from?
  expect(user).toBeDefined();
});

// Good: creates test data explicitly
it('gets user', async () => {
  const created = await createUser({ email: 'test@example.com', name: 'Test' });
  const user = await getUser(created.id);
  expect(user.email).toBe('test@example.com');
});
```

## Running Tests

**Local Development:**
```bash
# Watch mode (re-run on file change)
npm test -- --watch

# Single run
npm test

# Filter by test name
npm test -- --grep "returns ok"

# Coverage
npm test -- --coverage
```

**In CI/CD:**
```bash
npm test  # Runs in CI mode (single run, no watch)
```

---

*Testing analysis: 2026-06-05*
