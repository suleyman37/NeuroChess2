# Objective Reservoir

A20AN introduces a local objective reservoir for autonomous micro-missions. It is the offline source of useful work when ChatGPT Web, Gemini, Chrome, SMTP, or any other live dependency is unavailable.

Tracked source:

- `ops/autopilot/objective_reservoir.yaml`

Purpose:

- Keep autonomous work moving without user intervention.
- Prefer visual production objectives when no hard blocker exists.
- Route blocked live-web work to offline objectives instead of retry loops.
- Keep each micro-mission small, bounded, and constrained by allowed paths.

Objective families:

- `ORCHESTRATOR_RELIABILITY`: no-prompt runners, rotation dry-runs, alert router checks, page-state classifiers.
- `VISUAL_PRODUCTION_MODE`: Constitution Candidate V0, 10 Signature Candidate probes, screenshot plans.
- `SIGNATURE_COMPONENTS`: Sacred Board Chamber, Piece Identity System, Decision Feedback Language, Critical Moment Sigil, Aftermath Timeline, Piece Breath, Memory Cabinet, Decision Pressure Field.
- `HUMAN_TASTE_CALIBRATION`: vote sheet and daily screenshot bundle preparation without live user voting.
- `NIGHT_MODE_READINESS`: bounded rehearsal, morning report, failure ledger, pixel mandate checks.
- `SAFETY_MAINTENANCE`: no-secrets, no-road-push, no-local-runtime, no-prompt-leak checks.

Each objective declares:

- id
- family
- priority
- expected value
- risk tier
- allowed paths
- forbidden paths
- expected artifacts
- success criteria
- fallback if blocked

Autonomous mode may select from this reservoir without asking the user. If live GPT is blocked, the conductor parks that lane and continues with reservoir-backed work.
