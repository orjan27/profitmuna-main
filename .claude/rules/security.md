---
paths:
  - '**/*.{ts,tsx,js,jsx,java,kt}'
  - '**/Dockerfile*'
  - '**/docker-compose*.{yml,yaml}'
  - '**/helm/**/*.{yaml,yml}'
---

# Security

- Never concatenate user input into SQL strings. Use parameterized queries: Drizzle ORM placeholders, Spring Data `@Query` with named params, or `JdbcTemplate` with `?`.
- Never pass user input to `eval()`, `Function()`, `vm.runInNewContext()`, or `Runtime.exec()` without strict allowlisting.
- Never assign user input to `innerHTML`, `outerHTML`, or use `dangerouslySetInnerHTML` with unsanitized data. Use text content or DOMPurify.
- Validate and sanitize all path parameters, query strings, and request bodies at the route boundary before any processing.
- Escape output contextually: HTML entities in HTML context, URL-encoding in URL context, JSON encoding in JSON context.
- Set `Content-Type` headers explicitly. Never serve user-uploaded content with an inferred MIME type.
- Enforce authentication on every route except explicitly public endpoints. List public endpoints in a central allowlist.
- Check authorization (role/scope/ownership) after authentication, before any database query or mutation.
- Hash passwords with bcrypt (cost >= 12) or Argon2id. Never store plaintext or reversibly encrypted passwords.
- Use constant-time comparison for tokens and secrets (`crypto.timingSafeEqual` in Node, `MessageDigest.isEqual` in Java).
- Set cookies with `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` where feasible). Never store session tokens in `localStorage`.
- Use short-lived JWTs (15 minutes max) with refresh token rotation. Validate `iss`, `aud`, `exp` on every request.
- Implement CSRF protection on state-changing endpoints. Use SameSite cookies plus a CSRF token for cross-origin forms.
- Set these headers on every HTTP response: `Strict-Transport-Security` (max-age >= 31536000, includeSubDomains), `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (restrict camera, microphone, geolocation).
- Remove `Server` and `X-Powered-By` headers in production.
- Never use `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`. Allowlist specific origins.
- Limit `Access-Control-Allow-Methods` to only the HTTP methods the API actually uses.
- Never hardcode API keys, passwords, tokens, or connection strings in source code. Load from environment variables or a secrets manager.
- Never log secrets, tokens, passwords, or full authorization headers. Log only correlation IDs and resource IDs.
- Never return stack traces, internal error messages, or database error details to the client. Return a generic error with a correlation ID; log the full error server-side.
- Return appropriate HTTP status codes: 401 for unauthenticated, 403 for unauthorized, 422 for validation failure. Do not use 200 for errors.
- Pin dependencies to exact versions in lock files. Run `npm audit` or `./gradlew dependencyCheckAnalyze` before merging dependency changes.
- Apply rate limiting to authentication endpoints, password reset, and any endpoint that sends email or SMS. Return `429 Too Many Requests` with a `Retry-After` header.
