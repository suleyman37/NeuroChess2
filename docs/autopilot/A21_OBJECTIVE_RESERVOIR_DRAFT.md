# A21 Objective Reservoir Draft

Status: draft only. A21 was not executed by this mission.

This reservoir lists candidate objectives for a future product-safe long run.
Each objective is branch-isolated and must still pass Mission Contract, Shadow
Plan, Branch Orthogonality, Environment Hygiene, Budget/Quota, Marginal Value,
Visual Halting, and Control Plane approval before execution.

Forbidden across all objectives:

- active Practice mutation;
- `due_at` changes;
- Daily Plan mutation;
- `training_items` writes;
- `practice_attempts` writes;
- scoring/result writes;
- DB migrations;
- `package.json` or `package-lock.json` changes;
- production V1 behavior changes;
- auto-merge to `road-to-V2`;
- fake XP, rank, Elo, Transfer, fake neuroscience, LLM coach, Candidate Trainer,
  or user-facing fake progress claims.

## Objective A21-01 - North Star Human Review Packet

- lane: Visual/product DEV-only prototypes
- product value: Turn A20L evidence into a reviewable decision packet for the
  user without changing product code.
- risk tier: low
- allowed paths: `docs/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, `docs/rebuild/**`, `plan/**`,
  package files, `ops/autopilot/local/**`
- measurable output: one review packet with selected screenshots paths,
  strengths, weaknesses, and explicit questions for human visual review
- evidence required: links/paths to A20L contact sheets and JSON evidence
- stop conditions: missing A20L evidence, any request to edit frontend, any
  attempt to commit screenshots
- max files: 2
- max diff lines: 350
- screenshots required: no new screenshots
- browser smoke required: no
- human review required before merge: yes

## Objective A21-02 - Visual Firewall Evidence Index Backfill

- lane: Browser smoke/evidence strengthening
- product value: Make strict visual evidence easier to audit after long runs.
- risk tier: low
- allowed paths: `docs/autopilot/**`, `ops/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, `docs/rebuild/**`, `plan/**`,
  package files, `ops/autopilot/local/**`
- measurable output: evidence index entries or protocol fixture for A20K/A20L
  board-stage proof
- evidence required: external artifact paths, existence checks, JSON parse
- stop conditions: missing external artifacts, need to copy screenshots into repo
- max files: 4
- max diff lines: 450
- screenshots required: no
- browser smoke required: no
- human review required before merge: no, but report required

## Objective A21-03 - Board Stage Strict Gemini Packet Builder Dry Run

- lane: Static tests/gates
- product value: Prepare strict visual-provider prompts without calling Gemini.
- risk tier: low
- allowed paths: `ops/autopilot/**`, `docs/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, package files,
  `ops/autopilot/local/**`
- measurable output: packet builder fixture that includes strict hard gates and
  rejects placeholder enum responses
- evidence required: generated JSON fixture and test output
- stop conditions: live Gemini call requested, MICRO_PROMPT or codex_prompt
  fields appear, schema omits hard gates
- max files: 5
- max diff lines: 500
- screenshots required: no
- browser smoke required: no
- human review required before merge: no

## Objective A21-04 - A20L Board Stage Readability Browser Recheck

- lane: Browser smoke/evidence strengthening
- product value: Reconfirm board geometry and anti-spoiler constraints after
  branch drift.
- risk tier: medium
- allowed paths: `scripts/browser_a20l_*.mjs`, `docs/autopilot/**`
- forbidden paths: `frontend/**` except read-only branch checkout, `backend/**`,
  package files, screenshots in repo
- measurable output: fresh external smoke report and contact sheet path recorded
  in a report
- evidence required: external QA artifact directory, console log, smoke JSON
- stop conditions: app cannot start cleanly, frontend code edit needed, package
  install needed
- max files: 2
- max diff lines: 300
- screenshots required: yes, external only
- browser smoke required: yes
- human review required before merge: yes

## Objective A21-05 - Product-Safe DEV Route Inventory

- lane: Documentation of product decisions
- product value: List DEV-only routes and ensure none are mistaken for V1
  production surfaces.
- risk tier: low
- allowed paths: `docs/autopilot/**`, `docs/design/**`
- forbidden paths: `frontend/**`, `backend/**`, package files
- measurable output: route inventory with purpose, branch, visibility, and
  consolidation status
- evidence required: `rg` output summary and referenced branch/report docs
- stop conditions: route discovery requires product code edits
- max files: 2
- max diff lines: 300
- screenshots required: no
- browser smoke required: no
- human review required before merge: no

## Objective A21-06 - Sacred Board Contract Test Fixture Expansion

- lane: Static tests/gates
- product value: Make board pollution and pre-feedback hint failures harder to
  miss in future visual missions.
- risk tier: low
- allowed paths: `ops/autopilot/**`, `docs/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, package files
- measurable output: new fixtures and tests for board-core pollution,
  pre-feedback destination glow, and unreadable pieces
- evidence required: passing strict visual firewall test
- stop conditions: test requires frontend changes or image commits
- max files: 8
- max diff lines: 650
- screenshots required: no
- browser smoke required: no
- human review required before merge: no

## Objective A21-07 - Frontend Read-Only UX Friction Audit

- lane: Frontend read-only UX improvements behind dev flags
- product value: Identify the smallest high-value V1 friction candidates
  without changing production behavior.
- risk tier: medium
- allowed paths: `docs/autopilot/**`, external QA artifacts
- forbidden paths: `frontend/**`, `backend/**`, package files, DB files
- measurable output: one friction audit report with candidate missions and risk
  tiers
- evidence required: screenshots or existing smoke outputs if available
- stop conditions: mission drifts into implementation or product route changes
- max files: 1
- max diff lines: 400
- screenshots required: optional, external only
- browser smoke required: optional
- human review required before merge: yes

## Objective A21-08 - V1 Shell No-Regression Smoke Strengthening

- lane: Browser smoke/evidence strengthening
- product value: Strengthen proof that DEV-only visual branches do not alter
  V1 shell navigation.
- risk tier: medium
- allowed paths: `scripts/browser_*smoke*.mjs`, `docs/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, package files
- measurable output: smoke script or report checking Aujourd'hui, Mes parties,
  Entrainement, and absence of hidden board-stage routes in normal V1 shell
- evidence required: smoke JSON and console log
- stop conditions: requires package install, requires product route edits, or
  smoke cannot run without credentials
- max files: 3
- max diff lines: 500
- screenshots required: optional, external only
- browser smoke required: yes
- human review required before merge: no

## Objective A21-09 - Read-Only Backend Proof Route Audit

- lane: Read-only backend proof routes/tests only if no red-tier mutation
- product value: Prove future long-run backend checks can avoid training and
  scheduling writes.
- risk tier: medium
- allowed paths: `docs/autopilot/**`, `ops/autopilot/**`, backend tests only if
  strictly read-only and explicitly contracted
- forbidden paths: DB migrations, production backend logic, `training_items`,
  `practice_attempts`, `due_at`, scoring writes
- measurable output: read-only proof report or fixture-mode test
- evidence required: before/after DB or fixture state proof, no mutation log
- stop conditions: any write path is required, backend full suite unexpectedly
  fails unrelatedly, scope expands into product behavior
- max files: 4
- max diff lines: 500
- screenshots required: no
- browser smoke required: no
- human review required before merge: yes

## Objective A21-10 - A20L Visual Debt Register

- lane: Design contract hardening
- product value: Convert A20M visual court weaknesses into a concrete backlog
  for future art direction missions.
- risk tier: low
- allowed paths: `docs/autopilot/**`, `docs/design/**`
- forbidden paths: `frontend/**`, `backend/**`, package files
- measurable output: visual debt register with owner branch, defect, severity,
  evidence path, and next action
- evidence required: A20L contact sheet and A20M court report references
- stop conditions: attempts to fix CSS or edit frontend
- max files: 2
- max diff lines: 350
- screenshots required: no
- browser smoke required: no
- human review required before merge: yes

## Objective A21-11 - Morning Report Template For Dynamic Night Runs

- lane: Evidence amplification
- product value: Make the post-run summary more decision-useful and less
  dependent on raw logs.
- risk tier: low
- allowed paths: `docs/autopilot/**`, `ops/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, package files
- measurable output: report template covering branch classification, evidence,
  visual gates, policy gates, tests, and next decisions
- evidence required: fixture report rendered from sample run JSON
- stop conditions: requires live ChatGPT/Gemini, asks user for runtime approval,
  or summarizes secrets/session data
- max files: 4
- max diff lines: 500
- screenshots required: no
- browser smoke required: no
- human review required before merge: no

## Objective A21-12 - Limited Rehearsal Controller Dry Run

- lane: Static tests/gates
- product value: Dry-run a bounded 3-hour rehearsal plan without executing
  product missions.
- risk tier: medium
- allowed paths: `ops/autopilot/**`, `docs/autopilot/**`
- forbidden paths: `frontend/**`, `backend/**`, package files, DB files,
  `ops/autopilot/local/**`
- measurable output: fixture-mode controller plan that chooses objectives,
  rejects unsafe lanes, enters DRAIN, and writes no product data
- evidence required: test output, dry-run report, final state JSON parse
- stop conditions: any live Night Mode start, any product mission execution, any
  command that would mutate road
- max files: 6
- max diff lines: 700
- screenshots required: no
- browser smoke required: no
- human review required before merge: no

## Draft Readiness Summary

Recommended first rehearsal objective set:

1. A21-01
2. A21-02
3. A21-03
4. A21-08
5. A21-10
6. A21-12

These objectives are mostly docs/ops and evidence. They exercise the long-run
control plane without risking product data or production V1 behavior.
