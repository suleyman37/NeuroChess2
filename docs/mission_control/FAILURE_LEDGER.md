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

### F002a - Review Correction Best Move Marked As Problem

- Symptom: in Review/Lesson Correction, the displayed user move `Nxe4` was also
  shown as the best move, while the UI still rendered `Ton coup - Probleme`,
  `Opportunite manquee`, and a missed-best reproach.
- Risk: reopens the same trust failure outside the Practice smoke path.
- Fixed by: `e37c4cc Fix Review correction feedback contradiction`.
- Anti-regression rule: Correction must not render `Ton coup - Probleme` when
  the displayed move equals the best or accepted move; Correction must not
  render `Opportunite manquee` for best/accepted moves; Correction must not say
  `Le meilleur coup etait X` as a reproach when X was played.
- Success-state anti-regression: after a best/accepted Review try, the success
  panel must offer `Continuer` and `Voir pourquoi ca marche`, not prominent
  retry/correction CTAs; historical diagnostics must be framed as recovered
  context such as `Gain recupere : +N pts par rapport au coup joue`, never as a
  negative current-attempt delta or `Qualite : Moyenne`.
- Attempt-specific feedback anti-regression: after a current Review try-move,
  concrete historical commentary from the original game must not be presented as
  if it describes the attempted move. If no attempt-specific reply/PV exists,
  use short safe feedback; any historical line comparison must be clearly
  labelled as `Dans la partie`.
- Review Training continuation anti-regression: after best/very_good/accepted
  feedback, the active Review Training panel must show `Position suivante` or
  `Terminer la session` locally; next must advance/reset the item without
  creating a duplicate attempt.
- Line-action anti-regression: `Voir la ligne` must either open contextual
  line actions with visible playback (`Lire la ligne jouee` / `Lire la ligne
  solution`, active line, step label, current move, controls, and board/FEN
  change on `Suivant`) or be hidden/disabled when no playable line is
  available.
- Review POV/layout anti-regression: in `Les deux`, the board orientation must
  follow the current moment/item side instead of stale user/global color; `Moi`
  must be hidden/disabled/explained when `user_color` is unknown; Review
  Training must keep the board, feedback, primary next action, and active line
  player usable without burying controls below the fold.
- Required tests/smokes:
  `scripts/browser_review_correction_no_contradiction_smoke.mjs`,
  `scripts/browser_review_correction_player_pov_impact_smoke.mjs`, and
  `scripts/browser_review_success_state_ux_smoke.mjs`,
  `scripts/browser_review_attempt_specific_feedback_and_line_smoke.mjs`,
  `scripts/browser_review_training_continuation_and_line_playback_user_contract_smoke.mjs`,
  `scripts/browser_review_user_pov_focus_layout_contract_smoke.mjs`.
- Evidence required: Correction-tab DOM assertions and screenshots proving
  success/accepted feedback for the exact displayed best move, clean success
  CTAs, player-safe historical gain copy, no stale historical reply after a
  current wrong attempt, local next/finish Training continuation, and
  visible/non-dead line playback behavior.
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

## F006 - Absurd Review Retry / Out-Of-List Move Auto-Wrong

- Symptom: a clean or near-equal opening game could still produce a forced
  Review retry, and a legal try-move outside `accepted_moves_json` could be
  marked `wrong` without stabilized evidence.
- Risk: user loses trust in Review because harmless or playable alternatives
  look like chess mistakes.
- Fixed by: P1 Review trust PV5/stable classification mission.
- Anti-regression rule: legal out-of-list moves require cached or bounded
  stabilized resulting-position evaluation before final classification; if that
  evaluation is unavailable, use `needs_rebuild` / unknown-safe, not `wrong`.
  Early near-equal opening drift must be filtered before forced retry selection.
- Required tests/smokes:
  `backend/tests/test_try_move_model.py`, `backend/tests/test_review_service.py`,
  `backend/tests/test_training_items_daily_plan.py`,
  `backend/tests/test_database.py`, and
  `scripts/browser_review_trust_pv5_stable_classification_smoke.mjs`.
- Evidence required: candidate payload, classification band evidence,
  low-impact opening gate assertions, and no scheduling regression proof.
- Owner/status: Codex / fixed in WIP, keep under regression watch after commit.
