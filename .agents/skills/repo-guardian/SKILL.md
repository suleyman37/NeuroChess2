# Repo Guardian

Use this skill when an automated mission needs to protect the NeuroChess repo
from dirty worktrees, forbidden paths, accidental staging, unsafe routes, or
scope creep.

## Procedure

1. Run `git status --short --branch`, `git diff --stat`,
   `git diff --name-only`, `git diff --cached --name-only`, and
   `git diff --check`.
2. If `.serena/project.yml` is the only dirty tracked file, restore only that
   file.
3. Reject or quarantine any task touching:
   - `.venv/`
   - `qa_artifacts/`
   - `backend/neurochess/data/openings_book.json`
   - product paths outside the task allowlist
4. Never use `git add -A`.
5. Stage explicit files only after checks pass.

## Promotion Notes

- Docs/tooling tasks can promote directly when deterministic checks pass.
- UI tasks need browser proof or a visual critic.
- Backend read-only tasks need anti-mutation proof.
- Write-sensitive tasks go to quarantine.
