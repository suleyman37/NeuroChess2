# Rollback Procedure

- Before any significant mission: run `git status --short --branch` and note existing dirty/untracked files. Never revert user changes without explicit permission.
- Prefer one branch or worktree per important mission.
- During mission: keep patches small; inspect diffs frequently; stop if scope drifts.
- After mission: list modified files, tests run, results, risks, and manual/browser validation needed.
- If direction is wrong but changes are local and known: use targeted `git restore -- <path>` only with user approval when files may contain user changes.
- If corruption or complex bad state occurs: inspect `git status`, `git diff`, and `git reflog`; choose targeted restore/reset/reflog recovery with explicit human approval.
- For generated DB/cache artifacts, do not delete blindly; confirm path and purpose first.
- Use `/review` before merge or large modification.