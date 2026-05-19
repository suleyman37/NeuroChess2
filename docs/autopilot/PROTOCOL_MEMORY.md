# Protocol Memory

Tracked files:

- `ops/autopilot/protocol_memory.yaml`
- `ops/autopilot/protocol_memory_update.ps1`

Protocol Memory stores reusable automation lessons only.

Entry fields:

- id
- date
- category
- lesson
- evidence
- action_rule
- expires_after_missions
- confidence
- source_mission

Rules:

- max 100 entries;
- each lesson max 80 words;
- duplicate lessons merge;
- stale entries are flagged;
- no secrets;
- no private URLs;
- no long logs.

Examples:

- Do not use GPT Web as a required dependency.
- Visual missions require screenshots.
- If live web blocks twice, park the lane.
- Codex patch contracts should remain under 900 words.
