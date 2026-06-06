# Phase 6: Settings & Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 6-settings-notifications
**Areas discussed:** Reminder schedule, Notification sources

---

## Area Selection

| Option                 | Description                                                                | Selected |
| ---------------------- | -------------------------------------------------------------------------- | -------- |
| Currency setting       | Curated list vs full ISO? Symbol vs locale formatting? Storage location?   |          |
| Reminder schedule      | Schedule options, time of day, cron mapping, Manila timezone               | ✓        |
| Notification center UX | Bell dropdown vs page, badge, mark-as-read, pagination                     |          |
| Notification sources   | What events create in-app notifications (reference types are booking-only) | ✓        |

Currency setting and Notification center UX were left to Claude's discretion with defaults noted in CONTEXT.md.

---

## Reminder Schedule

| Option                                 | Description                                                             | Selected |
| -------------------------------------- | ----------------------------------------------------------------------- | -------- |
| Daily / Weekly / Monthly (Recommended) | Three frequency presets; weekly picks day of week, monthly day of month | ✓        |
| Weekly only                            | Just pick a day of week — one cron path, minimal UI                     |          |
| Daily / Weekly only                    | Two presets, no day-of-month edge cases                                 |          |

**User's choice:** Daily / Weekly / Monthly

| Option                                        | Description                                                          | Selected |
| --------------------------------------------- | -------------------------------------------------------------------- | -------- |
| Fixed time, e.g. 9:00 AM Manila (Recommended) | One daily cron at a fixed hour; no time picker UI                    |          |
| User picks the hour                           | Hour dropdown (Manila time); requires hourly cron checking who's due | ✓        |

**User's choice:** User picks the hour — flexibility preferred over cron simplicity

| Option                               | Description                                                   | Selected |
| ------------------------------------ | ------------------------------------------------------------- | -------- |
| Always send                          | Fires on schedule regardless of activity; predictable, simple | ✓        |
| Skip if already logged (Recommended) | Check for income in current period before sending             |          |

**User's choice:** Always send — user declined the recommended smart-skip

| Option                     | Description                                                       | Selected |
| -------------------------- | ----------------------------------------------------------------- | -------- |
| Simple nudge (Recommended) | Short message + link to income page; matches existing email style | ✓        |
| Nudge + quick summary      | Include period stats; adds per-user aggregate queries to cron     |          |

**User's choice:** Simple nudge

---

## Notification Sources

| Option                               | Description                                                       | Selected |
| ------------------------------------ | ----------------------------------------------------------------- | -------- |
| Income reminder mirror (Recommended) | Cron drops the email nudge into the in-app center too             | ✓        |
| Pending income due                   | Notify when a PENDING income's expectedReleaseDate arrives        | ✓        |
| Welcome notification                 | Seed one notification at first login so the center is never empty |          |

**User's choice:** Reminder mirror + Pending income due (multi-select); no welcome notification

| Option                    | Description                                                      | Selected |
| ------------------------- | ---------------------------------------------------------------- | -------- |
| In-app only (Recommended) | Keeps email limited to opted-in scheduled reminders              | ✓        |
| In-app + email            | Also email per due income — reverses no-per-event-email decision |          |

**User's choice:** In-app only

| Option                    | Description                                                      | Selected |
| ------------------------- | ---------------------------------------------------------------- | -------- |
| Notify once (Recommended) | One notification on the expected release date; needs dedup guard | ✓        |
| Re-notify while overdue   | Repeat daily until received — can pile up unread entries         |          |

**User's choice:** Notify once

| Option                         | Description                                          | Selected |
| ------------------------------ | ---------------------------------------------------- | -------- |
| Link + mark read (Recommended) | Click marks read and navigates via the `link` column | ✓        |
| Mark read only                 | Click toggles read state; no navigation              |          |

**User's choice:** Link + mark read

---

## Claude's Discretion

- Currency setting (SET-01): curated list with ₱ default, storage location, formatter wiring
- Notification center UX: bell/dropdown vs page, unread badge, mark-all-read, pagination/retention
- Settings page layout
- Notification type enum names; email/notification copy
- Cron handler architecture (scheduled export, due-user query, UTC→Manila bucketing, idempotency)
- Default reminder state (recommended: off until configured); day-31 clamping for monthly schedules

## Deferred Ideas

None — discussion stayed within phase scope.
