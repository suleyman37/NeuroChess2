# Branch Stacking Policy

Stacking means a new branch intentionally starts from, or depends on, a previous product branch instead of creating an unrelated branch from `road-to-V2`.

## Allowed

`STACK_ON_PREVIOUS_BRANCH` is allowed only when:

- overlap is intentional;
- the previous branch is `READY_TO_REVIEW` or `NEEDS_REWORK` but safe;
- the mission explicitly records the dependency;
- the Control Plane records the relationship;
- no product code is merged to `road-to-V2` by automation.

## Rejected

Use `REJECT_MISSION` when overlap is accidental, low value, broad, or avoidable. The planner should target different files or wait for review.

## Quarantine

Use `QUARANTINE_REQUIRED` when overlap touches red-tier or sensitive areas, when the branch base is unclear, or when multiple branches conflict in ways the morning reviewer cannot safely unwind.
