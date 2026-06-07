---
paths:
  - '**/*.{test,spec}.{ts,tsx,js,jsx}'
  - '**/src/test/**/*.{java,kt}'
---

# Testing

- Colocate test files next to the code they cover; mirror the source file's name and layout in `describe` / top-level test class names.
- Integration tests hit a real test database and real HTTP boundaries. Mock only third-party services that are out of your control (payment providers, external AI APIs, SaaS).
- One assertion concept per test. If you need multiple unrelated assertions, split the test.
- Do not snapshot API responses, DB rows, or anything with timestamps, IDs, or ordering that can drift. Assert on specific fields.
- Seed test data explicitly in the test or in a narrowly scoped fixture. Do not rely on leftover state from other tests.
- Tests must be deterministic — no network calls to production, no reliance on wall-clock time (freeze time or inject a clock).
- A failing test describes what broke in its name. Avoid names like `test1` or `works correctly`.
