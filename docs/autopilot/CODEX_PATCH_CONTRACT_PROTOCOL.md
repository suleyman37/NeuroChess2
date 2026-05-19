# Codex Patch Contract Protocol

Tracked script:

- `ops/autopilot/codex_patch_contract_builder.ps1`

Patch contracts are short execution briefs for Codex.

Default limit:

- 900 words

Must include:

- mission id
- objective
- allowed paths
- forbidden paths
- deliverables
- validation
- safety
- stop conditions
- final report format

Must not include:

- huge mission history
- private URLs
- secrets
- unnecessary logs
- motivational boilerplate

If a contract exceeds the limit, the builder compresses it. If it still exceeds the limit, the mission must be split.

A20AO rehearsal produced contracts averaging about 183 words.
