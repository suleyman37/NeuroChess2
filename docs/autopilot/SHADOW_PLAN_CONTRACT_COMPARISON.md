# Shadow Plan Contract Comparison

## Planned Vs Allowed

The comparison checks planned reads, creates, modifies, deletes, commands,
checks, artifacts, branch strategy, and diff budget against the Mission Contract
and, when available, normalized NC-MP/2 fields.

## Read Paths Vs Write Paths

Read paths can be broader than write paths only when policy allows it. Forbidden
paths remain forbidden for reads if policy marks them off-limits.

Write paths are stricter:

- create/modify/delete must fit `allowed_paths`;
- write paths must match `expected_changed_files` when exact mode applies;
- write count must stay within `max_files`.

## Checks And Artifacts

`planned_checks` must include required checks. `planned_artifacts` must include
expected artifacts. Missing checks or artifacts stop before work because the
mission would be unable to prove completion.

## Mismatch Outcomes

Outcomes:

- `MATCH`: execution may proceed in future integrated mode;
- `STOP_BEFORE_WORK`: the plan exceeds scope or violates constraints;
- `STOP_FOR_SUPERVISOR`: comparison cannot be completed safely.
