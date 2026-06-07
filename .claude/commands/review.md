---
description: Review pending changes in profitmuna-main
---

# Code Review

Review all pending changes against this project's standards.

## Steps

1. Run `git diff --stat` to see what files changed
2. Run `git diff` to read the full diff
3. Use the code-reviewer agent to analyze the changes
4. Check:
   - [ ] Naming follows STANDARDS.md conventions
   - [ ] No hardcoded secrets or credentials
   - [ ] TypeScript strict mode passes (`npm run typecheck`)
   - [ ] Tests exist for changed logic
   - [ ] No TODO/FIXME without a tracking reference

   - [ ] API routes validate input with Zod
   - [ ] D1 queries use parameterized bindings

5. Report findings grouped by severity: CRITICAL > WARNING > SUGGESTION

## Output

Provide a summary with:

- Total findings by severity
- One-line description per finding with file:line reference
- Recommendation: approve, request changes, or needs discussion
