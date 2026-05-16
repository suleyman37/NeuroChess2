# Product-Safe Night Mode Protocol

## Purpose

Product-Safe Night Mode exists so overnight autonomy can produce real
NeuroChess progress without pretending that unattended product code is safe to
merge directly into `road-to-V2`.

Night Mode v0 is productive but bounded. It may prepare docs, contracts,
read-only backend work, read-only frontend work, and smoke/test-only evidence.
It must not run red-tier work, active Practice, or hidden learning-state writes.

## Product Work Model

Docs-only and contract missions may auto-commit and push to `road-to-V2` when
the Mission Contract matches exactly, required checks pass, and Strategic Pulse
does not object.

Backend-readonly and frontend-readonly missions may produce code, but only on
ephemeral branches. Night Mode may leave those branches with evidence packs and
morning review recommendations. It must not auto-merge product code into
`road-to-V2`.

This differs from docs-only Night Mode: the system can advance real product
implementation, but it parks product code for supervised review instead of
silently promoting it.

## Required Safety Stack

Night Mode v0 requires:

- Mission Contract pre-registration and expected-vs-actual comparison.
- Prompt Firewall validation.
- Product-safe scope classification.
- Ephemeral branches for backend/frontend work.
- TDD separation for amber/backend-sensitive work.
- Anti-mutation evidence for backend-readonly work.
- Screenshot/contact-sheet evidence for frontend-readonly work.
- Watchdog heartbeat and stop-flag readiness.
- Strategic Pulse at configured intervals.
- ChatGPT Project READY and session rollover readiness.

## Default Run Limits

- `max_missions`: 15
- `max_wall_clock_hours`: 8
- `auto_drain_at_hours`: 7
- `max_consecutive_failures`: 1
- `max_total_failures`: 2
- `max_quarantines`: 1
- `max_same_mission_hash_repeats`: 1
- `max_total_diff_lines`: 1500
- `mission_timebox_minutes`: 10
- `strategic_pulse_every_missions`: 3
- `conversation_rollover_after_missions`: 5
- `request_more_max_rounds`: 2
- `prompt_repair_max_attempts`: 1

## Stop Conditions

Night Mode must stop when:

- ChatGPT bridge fails.
- Project READY is not valid.
- Session rollover fails.
- Watchdog heartbeat fails.
- Mission Contract mismatches actual results.
- Forbidden scope is touched.
- Red-tier work is detected.
- Prompt Firewall rejects twice.
- REQUEST_MORE exceeds the configured limit.
- Timebox checkpoint triggers.
- Strategic Pulse says `STOP`, `QUARANTINE`, or `HARDEN` outside Night Mode scope.
- Push fails.
- Repo is not clean before the next mission.
- Local Project URL is missing.
- Product-vs-automation balance warns that product progress is too low.

## Non-Execution Rule

A13 defines the protocol only. It does not run Night Mode, ask ChatGPT live, or
execute product missions.
