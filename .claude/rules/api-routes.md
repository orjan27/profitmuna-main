---
paths:
  - 'apps/api/**/*.{ts,java,kt}'
  - 'apps/worker/**/*.{ts,java,kt}'
---

# API Routes

- Validate every request body, path parameter, and query string at the route entry point. TypeScript: Zod schemas. Java/Kotlin: Bean Validation (`@Valid`, `@NotNull`, etc.).
- Return structured error responses with a stable shape: `{ error: { code, message, details? } }` and an appropriate HTTP status. TypeScript/Hono: throw `HTTPException`. Java/Spring: throw a domain exception mapped by `@ControllerAdvice`.
- Never log full request bodies, auth headers, or query strings that may contain PII or secrets. Log request IDs and resource IDs instead.
- Do not return internal error messages or stack traces to the client. Log them server-side with a correlation ID and return a generic message.
- Enforce authentication and authorization before touching the database.
- Keep route handlers thin — they validate, call a service/use-case, and shape the response. Business logic lives in services.
