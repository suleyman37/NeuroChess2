# Full Night Branch Quarantine

A true full-night pixel run must happen on a dedicated quarantine branch, never on `road-to-V2`.

## Rules

- Branch name must include a timestamp, for example `auto/a20ay-full-night-real-pixel-run-20260519-230000`.
- No `road-to-V2` push.
- No merge.
- No release tag.
- No branch deletion during a run.
- No broad staging and no `git add -A`.
- Stage explicit files only.
- Never stage screenshots, QA artifacts, `ops/autopilot/local/**`, or `ops/autopilot/runtime/**`.

## Required Final Report Fields

- Branch.
- Commit.
- Diff stat.
- Safety scan.
- Final git status.
