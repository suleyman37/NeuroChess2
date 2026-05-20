# Antigravity Patch Proposal Gate

Antigravity output enters NeuroChess only as a Patch Proposal Pack. Codex validates, rejects, or applies the pack.

## Pack Files

Required files:

- `proposal.json`
- `patch.diff`
- `summary.md`
- `risk_report.json`
- `test_report.json`
- `files_touched.txt`
- `integration_notes.md`

Screenshots stay external and are never committed.

## Proposal Metadata

`proposal.json` must include:

- proposal id and nonce;
- source agent and source worktree;
- base commit;
- clear objective;
- files changed;
- allowed and forbidden paths;
- dependency/package/backend flags;
- screenshot path redacted or external;
- tests and risks;
- rollback plan;
- recommended Codex action.

Recommended actions:

- `ACCEPT`
- `ACCEPT_WITH_FIXES`
- `REJECT`
- `RETRY_WITH_CONSTRAINTS`

## Reject Rules

The importer rejects a pack when:

- the nonce was already used;
- the base commit does not match the expected source commit;
- backend files are touched without explicit permission;
- package or DB files are touched;
- `ops/autopilot/local/**` or `ops/autopilot/runtime/**` is touched;
- screenshots, binary images, or external assets are included;
- secrets, private URLs, cookies, tokens, credentials, or ntfy topics appear;
- product/V1 behavior is changed without authorization;
- file count or diff lines exceed policy;
- summary, risk report, test report, clear objective, or rollback path is missing.

## Atomic Apply Strategy

Importer default is validation/dry-run. A future apply must:

1. create a temporary external worktree;
2. run `git apply --check`;
3. apply only inside the temporary worktree;
4. run validation/tests;
5. either import explicit approved files or reject;
6. remove the temporary worktree on rollback.

No broad staging is allowed. `git add -A` remains forbidden.

## Importer

The importer script is:

`ops/autopilot/import_antigravity_patch_proposal.ps1`

Supported modes:

- `Status`
- `Validate`
- `DryRun`
- `ApplyToTemp`

A20BH proves validation, rejection, nonce/idempotence, and rollback strategy without requiring real Antigravity execution.
