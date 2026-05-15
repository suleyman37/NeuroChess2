# Branch Garbage Collection

## 1. Purpose

Ephemeral branches keep autonomous work isolated, but they must not pile up forever. Branch garbage collection removes only branches that are safe to delete and already archived.

## 2. Archive Before Delete

No failed, promoted, or quarantined task branch may be deleted until an archive manifest exists.

Required archive files:
- `manifest.json`
- `branch_name.txt`
- `base_head.txt`
- `task_head.txt` when available
- `git_status.txt`
- `changed_files.txt`
- `diff.patch`
- `checks.log` or `checks_summary.md`
- `codex_report.md` when available
- `failure_reason.md` when failed
- `promotion_report.md` when promoted

## 3. Dry-Run Default

`cleanup_ephemeral_branches.ps1` reports candidates by default. It deletes nothing unless `-Apply` is passed.

## 4. Protected Branches

Garbage collection must never delete:
- `road-to-V2`
- `main`
- `master`
- any `origin/*` reference
- the current branch
- any branch with an active worktree
- any branch without an archived manifest
- quarantine branches younger than the retention threshold

## 5. Retention

Suggested retention:
- promoted green/blue branches: delete local branch after evidence export;
- failed green/docs branches: artifacts kept at least 7 days;
- failed blue/amber branches: artifacts kept at least 14 days;
- quarantine/red branches: keep branch and artifacts at least 30 days.

Artifacts remain under:

```text
C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\branches\
```

## 6. Cleanup Safety

Cleanup refuses deletion when evidence is missing. It also refuses protected branches even if `-Apply` is supplied.
