# Mission Contract Pre-Registration

Mission Contract Pre-Registration forces each future micro-mission to declare
its planned scope before Codex starts execution.

The contract exists because prompt validation alone is not enough. A prompt can
look safe, and Codex can later claim it stayed in scope, while the actual diff
quietly exceeds the intended file list, path boundary, check set, or artifact
expectation. Pre-registration creates a compact, machine-readable promise that
can be compared against the final result.

This protocol is not a replacement for Prompt Firewall. Prompt Firewall judges
whether a supervisor prompt is safe to execute. Mission Contract
Pre-Registration records what execution is expected to change, read, write, and
produce. Result comparison then decides whether the actual mission matched that
promise.

## When It Runs

The contract should be built after a MICRO_PROMPT passes Prompt Firewall and
before any repo edit is made.

The future execution order is:

1. Receive supervisor MICRO_PROMPT.
2. Validate through Prompt Firewall.
3. Build `mission_contract.json`.
4. Validate `mission_contract.json`.
5. Execute the mission.
6. Compare actual result to the registered contract.
7. Commit/push only if comparison passes and the mission policy allows it.

A11A documents and tests the protocol only. Live enforcement remains disabled.

## Required Fields

Every contract must declare:

- `mission_id`
- `risk_tier`
- `work_type`
- `goal`
- `expected_changed_files`
- `allowed_paths`
- `forbidden_paths`
- `max_files`
- `max_diff_lines`
- `expected_diff_lines_min`
- `expected_diff_lines_max`
- `expected_read_paths`
- `expected_write_paths`
- `required_checks`
- `expected_artifacts`
- `commit_policy`
- `stop_conditions`
- `red_tier_allowed`
- `backend_allowed`
- `frontend_allowed`
- `docs_rebuild_allowed`
- `package_changes_allowed`

Contracts should also declare `exact_file_match` whenever the mission expects a
fixed output file list. Exact file matching is the safest default for docs-only
and automation-safety micro-missions.

## Rejection Rules

Validation must reject contracts that are missing required fields, declare empty
file/path boundaries, use broad wording, or allow product surfaces without
explicit flags.

Broad wording includes:

- improve
- polish
- optimize
- refactor
- finalize
- stabilize
- as needed
- if necessary
- clean up everything
- handle everything
- continue the roadmap

Red-tier terms must not appear in non-red mission goals or write paths unless
the mission is explicitly quarantined and red-tier approved.

## Safety Effect

Pre-registration makes the expected scope tangible. It reduces false confidence
from narrative success reports and makes drift visible before another mission
can start.
