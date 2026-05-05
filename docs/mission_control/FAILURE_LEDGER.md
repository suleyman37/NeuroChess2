# Failure Ledger

The Failure Ledger records trust-critical regressions as anti-regression rules.
Each item should be consulted before related missions.

## F001 - Standard Analysis Last-Ply Hang

- Symptom: standard Review analysis hangs near the final ply; progress may reach
  the final position while the UI keeps spinning.
- Risk: user cannot trust analysis completion or recoverability.
- Fixed by: `93526c8 Fix standard review analysis finalization hang`.
- Anti-regression rule: standard analysis must materialize terminal or
  recoverable state when coverage is complete; timer must be monotonic from
  `started_at`/`created_at`; no spinner after terminal/recoverable state.
- Required tests/smokes:
  `scripts/browser_standard_analysis_last_ply_no_hang_smoke.mjs`.
- Evidence required: poll trace, final job status, final UI state, timer
  evidence, Review fetch or recovery CTA.
- Owner/status: Codex / fixed, keep under regression watch.

## F002 - Practice Best Move Marked As Problem

- Symptom: user plays `Bxf7+`; UI shows `Ton coup - Probleme` and also says the
  best move was `Bxf7+`.
- Risk: destroys learning trust; a correct answer is punished.
- Fixed by: `f308568 Fix practice feedback move classification`.
- Anti-regression rule: Practice/Review try-move classification is backend
  authoritative; move comparison is canonical UCI from FEN; best/accepted never
  renders a problem; accepted_moves_json is respected; incomplete legacy data
  must not false-wrong.
- Required tests/smokes:
  `scripts/browser_practice_best_move_feedback_success_smoke.mjs`.
- Evidence required: exact best move attempt, classification payload,
  practice_attempt `result=best`, no contradictory DOM labels.
- Owner/status: Codex / fixed, keep under regression watch.

## F003 - Live Analysis Spoiler Risk In Practice

- Symptom: live analysis could reveal best move, PV, or eval during an active
  Practice challenge.
- Risk: breaks the Plan1 try-before-reveal learning loop.
- Fixed by: live analysis no-spoiler guards in current V1 smoke coverage.
- Anti-regression rule: no live eval/best/PV before attempt or reveal; live
  analysis creates no practice_attempt, review_job, review_moment,
  training_item, or due_at.
- Required tests/smokes:
  `scripts/browser_practice_no_live_spoiler_smoke.mjs`.
- Evidence required: DOM absence checks before attempt/reveal and DB side-effect
  counts.
- Owner/status: Codex / guarded, keep under regression watch.

## F004 - Serena project.yml Noise

- Symptom: `.serena/project.yml` becomes dirty with generated language comments
  and `additional_workspace_folders: []`.
- Risk: accidental tooling noise gets staged with product changes.
- Fixed by: mission protocol cleanup rule.
- Anti-regression rule: if and only if the diff is the known harmless Serena
  block, restore only `.serena/project.yml`; do not stage or commit it.
- Required tests/smokes: `git diff -- .serena/project.yml` and final
  `git status --short --branch`.
- Evidence required: diff inspection and final status.
- Owner/status: Codex / known tooling noise.

## F005 - NeuroScore Weighting Drift

- Context: visible coach formula is
  `0.35 * reference_accuracy + 0.65 * neuro_score_diag`.
- Implementation version: `headline_neurochess_score_v2`.
- Fixed by: `cf54ffe Update coach NeuroScore weighting`.
- Risk: formula drift changes user-facing score semantics without a dedicated
  metric mission.
- Anti-regression rule: do not revert to `0.55 / 0.45`; do not expose raw
  `neuro_score_diag`; do not change formulas without explicit formula mission
  and tests.
- Required tests/smokes: targeted NeuroScore/calibration tests and plan guard.
- Evidence required: before/after calibration table and formula-version note.
- Owner/status: Codex / fixed, formula locked until next explicit mission.
