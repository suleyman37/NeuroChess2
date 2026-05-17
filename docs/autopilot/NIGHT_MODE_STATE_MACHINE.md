# Night Mode State Machine

Night Mode is a deterministic state machine, not a marathon. Time is a
cost/safety timeout. Success is measured by evidence-backed deliverables,
product value, safe consolidation, and a clear morning report.

## Phases

### EXPANSION

Purpose:

- create useful product branches or E2E deliverables;
- run backend, frontend, test, or smoke work only in controlled ephemeral
  branches;
- allow new product branches while the Control Plane and Mission Contract pass.

Exit to `CONSOLIDATION` when:

- required E2E deliverable quota is reached;
- `max_missions_expansion` is reached;
- Strategic Pulse says `NARROW` or `CONSOLIDATE`;
- Goldilocks detects sterile expansion.

### CONSOLIDATION

Purpose:

- improve confidence in branches created during expansion;
- add tests, screenshots, visual review, backend evidence, or docs for
  generated branches;
- avoid new feature branches unless an explicit exception is registered.

Exit to `DRAIN` when:

- branches are classified `READY_TO_REVIEW`, `NEEDS_REWORK`,
  `ABANDON_BRANCH`, or `QUARANTINE_REQUIRED`;
- two consecutive consolidation missions have zero E2E gain;
- the time/cost fuse approaches.

### DRAIN

Purpose:

- stop creating new work;
- generate the morning report;
- classify outputs and prepare next actions.

Exit with:

- `PASS_EARLY_EXCELLENCE` when quotas are achieved early and the report is
  complete;
- `PASS_FULL_NIGHT` when the time fuse is near and quotas are achieved;
- a partial verdict when useful work exists but the run is incomplete.

### QUARANTINE

Purpose:

- isolate dangerous or inconsistent state;
- produce a rescue pack;
- avoid destructive cleanup.

Forbidden in quarantine:

- destructive repository cleanup;
- hard reset;
- force push;
- automatic mainline rollback;
- automatic branch deletion.

## Time Policy

Do not require minimum wall clock for success. If quotas are met early, enter
`DRAIN`, produce the report, and stop with `PASS_EARLY_EXCELLENCE`.

Wall clock is only:

- `max_wall_clock` cost fuse;
- `auto_drain_at_hours` safety fuse;
- never a success target.
