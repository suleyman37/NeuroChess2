# A20L Revolutionary Board Stage Art Direction Report

## 1. Mission Summary

A20L created a new DEV-only North Star Board Stage route from the A20J3 strict
firewall branch:

`auto/a20l-revolutionary-board-stage-art-direction-upgrade-20260518`

Source branch:

`auto/a20j3-rework-3d-board-stage-tournament-strict-firewall-20260518`

Source commit:

`b67ed75`

New route:

`/app?boardStageNorthStar=1`

This mission does not consolidate the Board Stage into product flows. It is an
art direction/product prototype upgrade that preserves A20K hard gates while
raising the visual ambition beyond A20J3.

Final classification:

`REVOLUTIONARY_CANDIDATE_READY_TO_HUMAN_REVIEW`

This means the screenshot evidence is strong enough to review as a North Star
candidate. It does not mean production-ready, merged, or final game-changer
approved.

## 2. Base Branch And Commit

- Safe road branch: `road-to-V2`
- Road precheck HEAD: `7a71b0e`
- `origin/road-to-V2`: `7a71b0e`
- Source prototype branch: `auto/a20j3-rework-3d-board-stage-tournament-strict-firewall-20260518`
- Source prototype commit: `b67ed75`
- A20L branch: `auto/a20l-revolutionary-board-stage-art-direction-upgrade-20260518`

## 3. Why A20J3 Was Safe But Not Revolutionary Enough

A20J3 was a safety breakthrough:

- true top-down board;
- clean 8x8 grid;
- no pre-feedback traces;
- no board-surface artifacts;
- no product code merged to `road-to-V2`;
- V1 shell unchanged.

It was not yet a North Star direction because:

- the screen still looked like a tournament/audit harness;
- visible labels carried too much of the state meaning;
- pieces were prototype-like letter discs;
- feedback traces were basic;
- miss feedback was not elegant enough;
- all variants still shared too much of the same scaffold;
- the first viewport did not yet feel like a premium NeuroChess product moment.

## 4. What Was Visually Upgraded

A20L adds a separate North Star route and leaves the A20J3 route intact.

Upgrades:

- removed tournament variant selection from the North Star surface;
- removed visible `DEV-only`, `STRICT GATES`, file-id, and audit chrome from the
  main visual experience;
- replaced letter-disc pieces with styled Unicode chess pieces;
- rebuilt the stage as a premium decision chamber around the board;
- added stronger material depth, side architecture, memory rails, and state
  lighting outside the board core;
- made `observe`, `try_before_feedback`, `feedback_success`, `feedback_miss`,
  and `replay` feel meaningfully different;
- made miss feedback a reorientation trace rather than a punitive mark;
- preserved reduced motion and 2D fallback controls.

## 5. What Was Deliberately Removed

Removed from the North Star visual surface:

- tournament variant selector;
- visible strict-gate status box;
- file IDs and scene IDs;
- footer-style debug/audit labels;
- letter-disc pieces;
- pre-feedback board traces;
- visible solution/candidate/destination cues before effort;
- crude failure marks.

The A20J3 route remains available separately for evidence and comparison.

## 6. Sacred Board Contract Summary

Contract doc:

`docs/design/SACRED_BOARD_CONTRACT.md`

Core rule:

> Strict board, rich world. The chessboard is sacred. The stage is expressive.

Board core:

- true 8x8 grid;
- no distortion;
- no decorative atmosphere;
- no pre-feedback path, arrow, target, or destination glow;
- immediately readable pieces;
- post-feedback traces only after success, miss, or replay.

Browser smoke result:

`PASS_SACRED_BOARD_CONTRACT`

## 7. Zone Model

Contract doc:

`docs/design/BOARD_STAGE_ZONES_AND_FREEDOM_MODEL.md`

A20L applies four zones:

1. Board Core: maximum restriction.
2. Board Frame: controlled expression.
3. Surrounding Stage: high creative freedom.
4. Post-Feedback Pedagogy: dramatic but bounded.

The smoke verifies the strongest practical DOM/CSS check: no stage-world
elements are inside the board core, the board owns its center point, the board
has 64 visible squares, and pre-feedback states have zero board traces.

## 8. State-By-State Behavior

| State | Behavior | Result |
|---|---|---|
| observe | Calm chamber, clean board, no hint. | PASS |
| try_before_feedback | Tension gathers outside the board, no target or path. | PASS |
| feedback_success | Elegant post-feedback teaching trace appears. | PASS |
| feedback_miss | Reorientation trace appears without humiliation. | PASS |
| replay | Dotted memory path appears after feedback. | PASS |

## 9. Anti-Spoiler Proof

External evidence:

`anti_spoiler_check.json`

Result:

`PASS_ANTI_SPOILER`

Observed proof:

- `observe`: `PASS_NO_TRACE`
- `try_before_feedback`: `PASS_NO_TRACE`
- `feedback_success`: `PASS_POST_FEEDBACK_TRACE`
- `feedback_miss`: `PASS_POST_FEEDBACK_TRACE`
- `replay`: `PASS_POST_FEEDBACK_TRACE`

## 10. Product-Grade Assessment

Result:

`PRODUCT_GRADE_PASS`

Reasons:

- board is central and readable;
- first viewport feels like a serious desktop chess learning screen;
- no generic SaaS dashboard drift;
- no fake XP, rank, Elo, Transfer, neuroscience, or Practice-ready claim;
- visible state controls are product-like rather than audit-like;
- no package install, no external assets, no backend changes.

## 11. Premium Design Assessment

Result:

`PASS_PREMIUM_DIRECTION`

What improved:

- more memorable chamber identity;
- stronger board-as-artifact feeling;
- state-reactive color and atmosphere;
- better emotional separation between effort, success, miss, and replay;
- less visible proof scaffold than A20J3.

## 12. Game-Changer Assessment

Result:

`CANDIDATE_GAME_CHANGER_PENDING_HUMAN_REVIEW`

This report does not claim `GAME_CHANGER_PASS` as final truth. The screenshots
support a serious North Star candidate, but the direction still needs human
visual review before becoming the long-term product direction.

## 13. Remaining Weaknesses

- The route is still DEV-only and prototype-only.
- It is not wired to real Review or Practice state.
- The Unicode pieces are much more product-like than letter discs, but future
  product integration may still want a bespoke internal piece system.
- The side panels are cleaner than A20J3, but future work may further reduce UI
  chrome for teaser-grade composition.
- Gemini was not called during this mission; strict visual provider review can
  run later with the A20K context.
- The smoke checks practical DOM/CSS board pollution. Human screenshot review
  remains necessary for subjective atmosphere/overlap judgment.

## 14. Screenshots And Evidence Path

External evidence root:

`C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\board_stage_tournaments\A20L_revolutionary_board_stage_upgrade_20260518\`

Evidence includes:

- `northstar_observe_1366.png`
- `northstar_try_before_feedback_1366.png`
- `northstar_feedback_success_1366.png`
- `northstar_feedback_miss_1366.png`
- `northstar_replay_1366.png`
- `northstar_observe_1440.png`
- `northstar_try_before_feedback_1440.png`
- `northstar_feedback_success_1440.png`
- `northstar_feedback_miss_1440.png`
- `northstar_replay_1440.png`
- `northstar_observe_1920.png`
- `contact_sheet_northstar_states.png`
- `contact_sheet_before_after_a20j3_vs_a20l.png`
- `visual_ambition_score.json`
- `sacred_board_contract_check.json`
- `anti_spoiler_check.json`
- `browser_smoke_report.json`
- `console_log.txt`
- `manifest.json`

No screenshots or QA artifacts are committed to Git.

## 15. Consolidation Readiness

This is still prototype-only.

It is ready for human visual review as a revolutionary candidate, but it is not
ready for product consolidation or merge to `road-to-V2`.

Required before consolidation:

- human review of contact sheets;
- optional strict Visual Court rerun;
- explicit consolidation mission;
- plan for real chess-state wiring;
- decision on piece system;
- acceptance that A20K hard gates remain mandatory.

## 16. Recommended Next Mission

Recommended next mission:

`A20M_VISUAL_COURT_AND_ALL_NIGHT_READINESS_GATE`

Purpose:

- run strict visual court and human review on A20L evidence;
- decide whether the North Star route should feed future product work;
- keep A21 gated until visual ambition and safety agree.

## 17. A21 Was Not Launched

A21 was not launched.

Night Mode was not launched.

## 18. Road-To-V2 Was Not Pushed Or Merged

`road-to-V2` was not pushed.

No A20L product code was merged to `road-to-V2`.
