# Local Supervisor Fallback

Local Supervisor Fallback is the deterministic offline supervisor used when live GPT Web is unavailable.

Tracked script:

- `ops/autopilot/local_supervisor_fallback.ps1`

Selection policy:

- Prefer visual production if no hard blocker exists.
- Avoid the same failed live lane twice.
- Do not retry live web endlessly.
- If live web blocks, park it.
- If no visual probes exist, prioritize probe and signature setup work.
- If probes exist, prioritize Signature Five selection.
- If signatures are selected, prioritize tripled variants.
- If two signatures are tripled, prioritize limited autonomous pixel rehearsal.

A20AN implementation:

- Accepts an avoid-list so rehearsal previews can select distinct next objectives.
- Excludes orchestrator-reliability work when live web is parked unless no other work exists.
- Emits JSON only.
- Does not prompt.

The fallback is intentionally conservative: it keeps the loop productive without pretending live judge access is required.
