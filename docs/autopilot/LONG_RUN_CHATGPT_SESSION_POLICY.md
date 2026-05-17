# Long Run ChatGPT Session Policy

## Session Reuse

Long live runs should reuse the active NeuroChess Supervisor project
conversation whenever possible. The active URL lives only in
`ops/autopilot/local/chatgpt_sessions.local.json` and must never be committed.

Preferred lifecycle:

1. Acquire a clean dedicated Chrome profile.
2. Open the active project conversation once.
3. Verify project context and composer availability.
4. Send READY.
5. Reuse the same page for supervisor messages.
6. Health-check before every send.
7. Close only at DRAIN, STOP, QUARANTINE, or explicit cleanup.

## Health Checks Before Send

Before every READY, MICRO_PROMPT, REQUEST_MORE answer, Strategic Pulse, or
format repair, the bridge must confirm:

- project context is NeuroChess Supervisor;
- composer is visible and usable;
- no loading/interstitial page is blocking the UI;
- no human verification is visible;
- browser/page is still connected;
- current conversation remains project-scoped.

## Rollover

Rollover is controlled, never accidental. A new conversation is allowed only
when thresholds are reached, the session becomes unusable, context drift is
detected, repeated invalid responses occur, or a manual reset is requested.

Default local counters:

- `messages_in_session`;
- `assistant_responses_in_session`;
- `missions_in_session`;
- `rollover_threshold_messages`;
- `rollover_threshold_missions`;
- `last_ready_check`;
- `last_availability_check`.

## Drain / Stop

If remaining wall-clock time is too low for meaningful work, the controller
must enter DRAIN rather than starting another product mission. If the bridge
reports a blocked state, the run stops with a diagnostic report and does not
retry for hours.
