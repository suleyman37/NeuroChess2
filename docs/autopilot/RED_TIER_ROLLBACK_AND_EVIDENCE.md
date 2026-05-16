# Red-Tier Rollback And Evidence

## 1. Rollback First

Red-tier work must have a rollback plan before execution. The plan should explain:
- which files or migrations may change;
- how to revert code;
- how to restore or repair affected state;
- how to detect partial writes;
- how to stop safely if checks fail.

## 2. Required Evidence Pack

The red-tier evidence pack must include placeholders or real artifacts for:
- `mission_brief.md`
- `classification.json`
- `allowed_paths.txt`
- `forbidden_paths.txt`
- `precheck.txt`
- `branch_name.txt`
- `base_head.txt`
- `changed_files.txt`
- `diff.patch`
- `checks_summary.md`
- `db_snapshot_before_required.txt`
- `db_snapshot_after_required.txt`
- `db_mutation_report_required.txt`
- `route_inventory_required.md`
- `side_effect_inventory_required.md`
- `rollback_plan_required.md`
- `codex_report.md`
- `supervisor_response.md`
- `go_no_go.md`

Placeholders are blocking. The system must not fabricate DB snapshots.

## 3. BLOCKED Means BLOCKED

If a required item is missing or only a placeholder, promotion is blocked. The correct outcome is a quarantine report, not an automatic merge.
