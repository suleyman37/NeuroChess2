# Mission Protocol

Mission Control is a lightweight governance layer for future Codex work. It
does not replace Plan1, Plan2, or Plan3. It turns their doctrine into a
repeatable operating checklist.

## Core Doctrine

- One mission = one objective = one controlled diff = relevant tests = report.
- Read canonical docs before changing files.
- Start with git pre-flight checks.
- No stage, commit, or push by default.
- Never use `git add -A`.
- Do not broaden scope because nearby code looks tempting.
- Do not add product behavior without user/data/API/UI/error/recovery/test
  contracts.
- Evidence before confidence: prefer browser/API/DB proof over impression.
- Final report must include Go/No-Go, rollback, files changed, tests run, and
  remaining risks.

## Canonical Read Order

1. `AGENTS.md`
2. `docs/PLAN_SOURCE_OF_TRUTH.md`
3. `docs/PLAN_CONTEXT_MIN.md`
4. Relevant canonical plans in `plan/`
5. Relevant contracts in `docs/`
6. `docs/NEXT_PLAN_ACTIONS.md`
7. Existing code only after the source-of-truth docs are loaded

## Pre-Flight

- Run `git status --short --branch`.
- Run `git diff --stat`.
- Run `git diff --cached --stat`.
- Run `git diff --check`.
- Confirm branch and HEAD in the report.
- If unrelated dirty files exist, stop and report.
- If only `.serena/project.yml` is dirty with the harmless
  `additional_workspace_folders: []` block, restore only that file, then rerun
  status.
- If anything is staged unexpectedly, report it before touching files.

## Implementation

- Keep the diff inside the explicit mission boundary.
- Do not modify Plan1/Plan2/Plan3 unless the user explicitly asks for a narrow
  plan-source update.
- Do not change formulas, Stockfish, metric semantics, thresholds, training
  selection, or user data unless the mission explicitly authorizes it.
- Do not add forbidden V1 surfaces: Candidate Trainer, LLM coach, Intent Layer,
  visible Transfer Gap, ETV, FSRS, NeuroMonitor, brain/cortex/atlas, Cognitive
  Map, or a fourth main tab.
- For UI/runtime work, define the failure state and recovery action before
  claiming done.
- For backend-authoritative behavior, keep frontend display-only where possible.

## Validation

- Run tests proportional to the touched surface.
- Backend behavior change: targeted backend tests; full backend suite when risk
  is broad.
- Frontend behavior change: frontend build/typecheck and relevant browser
  smokes.
- Docs-only mission: `git diff --check`, plan guard, and any existing docs lint
  if available.
- Do not claim PASS for a command that was not run.
- Record exact commands and results.

## Evidence

- Runtime/UI missions should write `qa_artifacts/<MISSION_ID>/`.
- Screenshots alone are not enough; pair visual claims with DOM/API/DB
  assertions when feasible.
- Evidence packs are not staged by default.
- If evidence must be preserved before commit, move it outside the repo rather
  than committing it.

## Final Report

Include:

- mission name;
- branch and HEAD;
- initial git status;
- files changed;
- evidence generated;
- tests/checks with exact commands and PASS/FAIL;
- Go/No-Go recommendation;
- rollback plan;
- remaining risks;
- final git status;
- confirmation of no stage/commit/push unless explicitly authorized.

## Commit Authorization

Only stage/commit/push when the user explicitly authorizes it and all of these
are true:

- tests passed or failures are documented as unrelated and acceptable;
- staged files are exactly the mission files;
- no `qa_artifacts/`, temp DBs, logs, `.serena/project.yml`, `node_modules`, or
  pycache are staged;
- no forbidden V1 feature was introduced;
- no unrelated dirty files are included.

## Dirty Worktree Handling

- Classify dirty files before acting.
- Never discard another mission's work.
- Restore only files explicitly authorized by the mission.
- For Serena tooling noise, restore `.serena/project.yml` only when the diff is
  the known harmless generated config/comment block.

## Reusable Checklist

### PRE-FLIGHT

- [ ] Read canonical docs.
- [ ] Capture branch and HEAD.
- [ ] Run git status/diff/cached/diff-check.
- [ ] Resolve harmless Serena noise only if applicable.
- [ ] Stop on unrelated dirty files.

### IMPLEMENTATION

- [ ] Keep one objective.
- [ ] Touch only allowed files.
- [ ] Avoid forbidden V1 surfaces.
- [ ] Preserve formulas/metrics/Stockfish unless explicitly in scope.
- [ ] Update docs/contracts for any behavior change.

### VALIDATION

- [ ] Run plan guard when available.
- [ ] Run targeted tests.
- [ ] Run browser smoke for UI/runtime behavior.
- [ ] Run build/typecheck if frontend changed.
- [ ] Run `git diff --check`.

### EVIDENCE

- [ ] Create evidence pack for UI/runtime missions.
- [ ] Include screenshots only when useful.
- [ ] Include API/DB assertions where feasible.
- [ ] Keep evidence untracked unless explicitly authorized.

### FINAL REPORT

- [ ] Summarize root cause and fix.
- [ ] List files changed/added.
- [ ] List commands and PASS/FAIL.
- [ ] Provide Go/No-Go and rollback.
- [ ] Paste final git status.

### COMMIT AUTHORIZATION

- [ ] User explicitly authorized commit.
- [ ] Stage explicit files only.
- [ ] Verify staged name list.
- [ ] Commit with mission-specific message.
- [ ] Push only if explicitly requested.
