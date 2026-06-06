---
status: partial
phase: 01-authentication
source: [01-VERIFICATION.md]
started: 2026-06-06T01:55:00Z
updated: 2026-06-06T01:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Google OAuth consent flow (AUTH-03)

expected: With GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET configured and the callback URI registered in Google Cloud Console, clicking "Sign in with Google" completes consent, lands back signed in with access+refresh cookies, and creates/links a users row with google_id set and email_verified=true. A second sign-in with an email that already has a password account LINKS (no duplicate row).
result: [pending]

### 2. Live Resend verification email delivery (AUTH-01)

expected: With a real RESEND_API_KEY, registering delivers a "Verify your Profitmuna email" message; the link verifies the account.
result: [pending]

### 3. Live Resend welcome email delivery (AUTH-06)

expected: Registration also delivers a separate "Welcome to Profitmuna" message.
result: [pending]

### 4. Live Resend password reset email delivery (AUTH-04)

expected: Forgot-password delivers a "Reset your Profitmuna password" message; the link opens the reset form and a new password works.
result: [pending]

### 5. Production D1 migration apply (deploy-time)

expected: After `wrangler login` and replacing the placeholder database_id, `npx wrangler d1 migrations apply profitmuna-main-db --remote` succeeds and the remote DB has users/refresh_tokens/auth_tokens/login_attempts.
result: [pending]

### 6. Transparent BFF refresh across access-token expiry (AUTH-05)

expected: With both dev servers running and a logged-in session, after the access token nears expiry the next BFF request silently rotates tokens (new cookies set) without the browser ever seeing a 401.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
