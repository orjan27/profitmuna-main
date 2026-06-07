---
description: Pre-deployment verification for profitmuna-main
---

# Deploy Check

Verify this project is ready to deploy.

## Checks

### 1. Build

- Run `npm run build` and verify it succeeds with no errors

### 2. Type Safety

- Run `npm run typecheck` and verify zero errors

### 3. Tests

- Run `npm run test` and verify all tests pass

### 4. Lint

- Run `npm run lint` and verify no errors

### 5. Environment

- Verify `.env.example` lists every key used in the codebase
- Verify no `.env` files or secrets are staged in git

### 6. Dependencies

- Check for known vulnerabilities: `npm audit --production`

### 7. Cloudflare Workers

- Verify `wrangler.toml` has correct `compatibility_date`
- Verify D1 database binding name matches code
- Run `npx wrangler deploy --dry-run` if available

## Output

Report as a checklist:

```
[PASS] Build succeeded
[PASS] Types clean
[FAIL] 2 tests failing — describe which
[WARN] npm audit found 1 moderate vulnerability
```

Final verdict: READY / NOT READY with blocking issues listed.
