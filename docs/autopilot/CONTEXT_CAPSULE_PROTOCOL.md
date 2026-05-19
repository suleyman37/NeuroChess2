# Context Capsule Protocol

Tracked script:

- `ops/autopilot/context_capsule_builder.ps1`

Capsules are compact context packets for external models or local decision logic.

Default limit:

- 1200 words

Visual limit:

- 900 words when used for visual review

Included:

- current mission goal
- relevant repo state
- last three outcomes
- current blockers
- autonomy score snapshot
- requested decision
- artifact references

Excluded:

- huge histories
- secrets
- private ChatGPT or Gemini URLs
- private ntfy topics
- SMTP passwords
- repeated boilerplate
- raw screenshots
- large logs

If the capsule exceeds the limit, the builder compresses summaries and older outcomes. If it still exceeds the limit, it returns `CAPSULE_TOO_LARGE`.
