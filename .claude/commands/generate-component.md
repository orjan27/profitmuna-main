---
description: Generate a new UI component for profitmuna-main
argument-hint: component name (e.g. "UserCard")
---

# Generate Component: $ARGUMENTS

Create a new UI component following this project's conventions.

## Steps

1. Create the component file at `apps/web/src/components/$ARGUMENTS.tsx`
2. Use this structure:

```tsx
interface $ARGUMENTSProps {
  // Define props
}

export function $ARGUMENTS({ ...props }: $ARGUMENTSProps) {
  return <div>{/* Component markup */}</div>;
}
```

3. Follow these conventions:
   - PascalCase for component name and file name
   - Props interface named `{ComponentName}Props`
   - Use shadcn/ui primitives where applicable
   - Use `cn()` from `@/lib/utils` for conditional classes
   - Keep components focused — one responsibility per component

4. Consult `/nextjs-best-practices` to decide Server vs Client Component, data-fetching strategy, and whether the component needs `"use client"`.

5. Avoid AI-slop defaults: icon-tile-over-heading cards, gradient text, purple/cyan gradients, thick side borders, bounce easings.

6. If the component needs tests, create `apps/web/src/components/__tests__/$ARGUMENTS.test.tsx`

7. Run `npm run typecheck` to verify types pass
