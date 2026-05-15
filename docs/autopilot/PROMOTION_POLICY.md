# Promotion Policy

## Risk Tiers

### docs_tooling

Allowed to auto-commit and auto-push to `road-to-V2` when:

- changed files are inside the allowlist;
- no forbidden path is dirty or staged;
- `git diff --check` passes;
- `tools/plan_guard.py` passes when `docs/rebuild/` is touched.

### frontend_readonly

Allowed to auto-promote only when:

- frontend build passes;
- TypeScript passes;
- relevant REX/V1 smokes pass;
- network smokes prove no forbidden write route;
- text or visual critic passes, or deterministic visual proof is explicitly
  accepted by policy.

### backend_readonly

Allowed to auto-promote only when:

- targeted backend tests pass;
- anti-mutation proof exists;
- route/method audit confirms read-only behavior;
- local critic passes.

### write_sensitive

Not promoted directly during bootstrap. It must be committed to a quarantine
branch named `autopilot/<task-id>` with an incident or review report.

## Circuit Breaker

If three consecutive tasks fail, or one task fails three times, the queue enters
degraded mode. The runner writes an incident report and stops promoting until a
future queue item explicitly clears the degraded state.

## Never Stage

- `.serena/project.yml`
- `.venv/`
- `qa_artifacts/`
- `backend/neurochess/data/openings_book.json`
- any path outside the task allowlist
