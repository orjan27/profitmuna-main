---
phase: 1
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| **Framework**          | vitest 3.0.0 (apps/api)                                                  |
| **Config file**        | apps/api/vitest.config.ts (verify; Wave 0 installs if absent)            |
| **Quick run command**  | `npm run test --workspace apps/api`                                      |
| **Full suite command** | `npm run test --workspace apps/api && npm run typecheck && npm run lint` |
| **Estimated runtime**  | ~30 seconds                                                              |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace apps/api`
- **After every plan wave:** Run `npm run test --workspace apps/api && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior                     | Test Type | Automated Command | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------- | ----------------------------------- | --------- | ----------------- | ----------- | ---------- |
| 1-01-01 | 01   | 1    | AUTH-01     | T-1-01 / — | {expected secure behavior or "N/A"} | unit      | `{command}`       | ✅ / ❌ W0  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

_Note: planner populates this map per task in PLAN.md `<automated>` blocks; executor updates Status during execution._

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` — confirm test framework wired (install if absent)
- [ ] Auth service/unit test stubs for AUTH-01…AUTH-06

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior                                     | Requirement               | Why Manual                                          | Test Instructions                                                                                                |
| -------------------------------------------- | ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Google OAuth end-to-end sign-in              | AUTH-03                   | Requires live Google consent screen + real redirect | Configure GOOGLE_CLIENT_ID/SECRET, click "Sign in with Google", complete consent, confirm account created/linked |
| Resend email delivery (verify/welcome/reset) | AUTH-01, AUTH-04, AUTH-06 | Requires live Resend key + inbox                    | Trigger flow, confirm email received with working link                                                           |

_If none: "All phase behaviors have automated verification."_

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
