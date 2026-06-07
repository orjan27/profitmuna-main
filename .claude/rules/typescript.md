---
paths:
  - '**/*.{ts,tsx}'
---

# TypeScript

- `strict: true` is assumed; never disable it in `tsconfig.json`.
- Do not use `any`. If unavoidable, add `// intentional: <reason>` on the same line.
- Prefer `type` for unions and aliases; use `interface` for extensible object shapes.
- Use the project path aliases from `tsconfig.base.json` (for example `@/*`, `@app/db`) instead of deep relative imports.
- Narrow unknowns at the boundary. Do not leak `unknown` into business logic.
- Prefer `readonly` arrays and `as const` for literal data.
- Import types with `import type { ... }` when they are only used in type positions.
- No default exports in shared library code; default exports are allowed in Next.js route files (`page.tsx`, `layout.tsx`, etc.) where the framework requires them.
