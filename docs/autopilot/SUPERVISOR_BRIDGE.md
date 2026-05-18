# Supervisor Bridge

Supervisor Bridge is the optional live-supervisor adapter.

Tracked script:

- `ops/autopilot/supervisor_bridge.ps1`

Behavior:

1. Build a compact supervisor packet from the current objective, mission diagnosis, score state, and blockers.
2. Attempt GPT Web only when explicitly allowed.
3. If GPT Web is disabled, blocked, or unavailable, return `SUPERVISOR_LIVE_UNAVAILABLE`.
4. Mark fallback required.
5. Never ask the user for auth, URLs, READY, passwords, or manual intervention.

Live GPT Web is an accelerator, not a dependency. In unattended mode, the bridge parks live web and lets the local fallback supervisor choose the next objective.

Packet safety:

- no secrets
- no private ChatGPT URLs
- no ntfy topic
- no SMTP password
- no credential material

Current A20AN default:

- live web is optional
- `-NoLiveWeb` parks GPT Web immediately
- no external service wait is allowed
